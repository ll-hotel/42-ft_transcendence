import * as orm from "drizzle-orm";
import { db } from "./db/database";
import * as tables from "./db/tables";
import { tcheckFriends } from "./user/friend";

type HandlerFn = (data?: any) => void;
type UUID = string;
type Client = {
	sockets: WebSocket[],
	handlers: { topic: string, fn: (data?: any) => void }[],
	onMessage: HandlerFn[],
	onDisconnect: (() => void)[],
	lastOnlineTime: number,
};
export type BaseMessage = {
	service : string
	topic: string,
};
type MatchMessage = BaseMessage & {
	source: string,
	match: number,
	opponent: string,
};

type VersusMessage = BaseMessage & {
	source: string;
	content: string;
}

type Message = BaseMessage | MatchMessage | VersusMessage;

export const clients: Map<UUID, Client> = new Map();

export function isOnline(id: UUID) {
	const client = clients.get(id);
	if (!client) return false;
	for (const socket of client.sockets) {
		if (socket.readyState === WebSocket.OPEN) {
			client.lastOnlineTime = Date.now();
			return true;
		}
	}
	return false;
}

export async function connect(uuid: UUID, socket: WebSocket) {
	if (!clients.has(uuid)) {
		clients.set(uuid, {
			sockets: [],
			handlers: [],
			onMessage: [],
			onDisconnect: [],
			lastOnlineTime: 0,
		});
	}
	const client = clients.get(uuid)!;
	client.sockets.push(socket);
	client.lastOnlineTime = Date.now();
	
	socket.addEventListener("message", (event) => onMessage(client, event));
	socket.addEventListener("close", () => disconnect(uuid, socket));

	if (client.handlers.filter((h) => h.topic == "vs:invite").length === 0) {
		addListener(uuid, "vs:invite", async (json) => {

			if (isOnline(json.content)) {
				const [displaySender] = await db.select({displayName : tables.users.displayName}).from(tables.users).where(orm.eq(tables.users.uuid, uuid ));
				if (!displaySender)
					return;
				send(json.content, { source: uuid, topic: "vs:invite", service:"chat", content: displaySender.displayName });
			}
		});
		addListener(uuid, "vs:accept", (json) => {
			createMatch1vs1(uuid, json.content);
		});
		addListener(uuid, "vs:decline", (json) => {
			send(json.content, { source: uuid, topic: "vs:decline", service:"chat", content: json.content });
		});
	}
}
	
function updateOnlineTime(client: Client) {
	client.lastOnlineTime = Date.now();
}
function onMessage(client: Client, event: MessageEvent) {
	updateOnlineTime(client);
	try {
		const msg = JSON.parse(event.data);
		if (msg.source === "ping") return;
		client.onMessage.forEach((handler) => handler(msg));
		client.handlers.filter(handler => handler.topic == msg.topic).forEach((handler) => handler.fn(msg))
	} catch (_) {}
}

export function send(uuid: UUID, message: Message) {
	if (isOnline(uuid)) {
		try {
			const data = JSON.stringify(message);
			clients.get(uuid)!.sockets.forEach(socket => socket.send(data));
		} catch (err) {}
	}
}

export function addListener(clientId: UUID, topic: string, fn: HandlerFn) {
	const client = clients.get(clientId);
	if (!client) return;

	if (topic == "message") {
		client.onMessage.push(fn);
	} else if (topic == "disconnect") {
		client.onDisconnect.push(fn);
	} else {
		client.handlers.push({ topic, fn });
	}
}

/**
 * Closes all of client websockets, or the one specified.
 * Uses the error code 4001 to manifest a voluntary disconnection.
 */
export function disconnect(uuid: UUID, socket?: WebSocket) {
	const client = clients.get(uuid);
	if (!client) return;
	if (socket && socket.readyState === WebSocket.OPEN) {
		client.sockets = client.sockets.filter(e => e != socket);
		if (client.sockets.length == 0) {
			client.lastOnlineTime = Date.now();
		}
		socket.close(4001);
	} else {
		client.sockets.forEach(socket => socket.close(4001));
		client.sockets = [];
	}
	if (!isOnline(uuid)) {
		client.handlers = [];
		client.onDisconnect.forEach((handler) => handler());
	}
}

/** Removes all listeners for `topic`. */
export function removeListener(uuid: UUID, topic: string) {
	const client = clients.get(uuid);
	if (client) {
		client.handlers = client.handlers.filter((handler) => handler.topic !== topic);
	}
}

async function createMatch1vs1(uuid1: string, uuid2: string) {
	const [p1] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid1));
	const [p2] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid2));

	if (!p1 || !p2)
	{
		send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "User not find ! "});
		send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "User not find !"});
		return;
	}

	if (await !tcheckFriends(p1.id, p2.id))
	{
		send(uuid1,{source : "server",  service:"chat", topic: "vs:error", content : "Users aren't friends anymore !"});
		send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Users aren't friends anymore !"});
		return;
	}

	const matchAlreadyGoing = await db.select().from(tables.matches).where(orm.and(orm.or(
		orm.eq(tables.matches.player1Id, p1.id),
		orm.eq(tables.matches.player1Id, p2.id),
		orm.eq(tables.matches.player2Id, p1.id),
		orm.eq(tables.matches.player2Id, p2.id),
	),
	orm.or(orm.eq(tables.matches.status, "ongoing"), orm.eq(tables.matches.status, "pending"))
	));

	if (matchAlreadyGoing.length > 0)
	{
		send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		return;
	}

	const alreadyInQueue = db.select().from(tables.matchmakingQueue).where(orm.or(
		orm.eq(tables.matchmakingQueue.userId, p1.id),
		orm.eq(tables.matchmakingQueue.userId, p2.id))
	).prepare();
	
	if (alreadyInQueue.all().length) {
		send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a queue, sorry :("});
		send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a queue, sorry :("});
		return;
	}

	const [match] = await db.insert(tables.matches).values({
		player1Id : p1.id,
		player2Id : p2.id,
		status: "pending",
	}).returning();

	send(uuid1, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p2.username});
	send(uuid2, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p1.username});

}

export default {
	clients,
	isOnline,
	send,
	connect,
	disconnect,
	addListener,
	removeListener,
};
