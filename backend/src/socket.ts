import * as orm from "drizzle-orm";
import { db } from "./db/database";
import { matches, users } from "./db/tables";
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
	topic: string,
};
type MatchMessage = BaseMessage & {
	source: string,
	match: number,
	opponent: string,
};

type VersusMessage = BaseMessage & {
	source: string,
	target: string,
};
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

	addListener(uuid, "vs:invite", (json) => {
		if (isOnline(json.target)) {
			send(json.target, { source: uuid, topic: "vs:invite", target: json.target });
		}
	});
	addListener(uuid, "vs:accept", (json) => {
		createMatchBetween(uuid, json.target);
	});
	addListener(uuid, "vs:decline", (json) => {
		send(json.target, { source: uuid, topic: "vs:decline", target: json.target });
	});
}

function updateOnlineTime(client: Client) {
	client.lastOnlineTime = Date.now();
}
function onMessage(client: Client, event: MessageEvent) {
	updateOnlineTime(client);
	try {
		const json = JSON.parse(event.data);
		if (json.source === "ping") {
			return;
		}
		client.onMessage.forEach((fn) => fn(json));
		client.handlers.forEach((handler) => {
			if (handler.topic === json.source) {
				handler.fn(json);
			}
		});
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

async function createMatchBetween(uuid1: string, uuid2: string) {
	const [p1] = await db.select().from(users).where(orm.eq(users.uuid, uuid1));
	const [p2] = await db.select().from(users).where(orm.eq(users.uuid, uuid2));

	if (!p1 || !p2) {
		return;
	}

	if (await !tcheckFriends(p1.id, p2.id)) {
		// They aren't friend anymore, so we can't create a game, sorry :(
		return;
	}

	const matchAlreadyGoing = await db.select().from(matches).where(orm.and(
		orm.or(
			orm.eq(matches.player1Id, p1.id),
			orm.eq(matches.player1Id, p2.id),
			orm.eq(matches.player2Id, p1.id),
			orm.eq(matches.player2Id, p2.id),
		),
		orm.eq(matches.status, "ongoing"),
	));

	if (matchAlreadyGoing.length > 0) {
		// Someone is already in a match, sorry :(
		return;
	}

	const [match] = await db.insert(matches).values({
		player1Id: p1.id,
		player2Id: p2.id,
		status: "ongoing",
	}).returning();

	send(uuid1, { source: "server", topic: "vs:start", match: match.id, opponent: p2.username });
	send(uuid2, { source: "server", topic: "vs:start", match: match.id, opponent: p1.username });
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
