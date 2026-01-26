import { matches, users } from './db/tables';
import { db } from './db/database';
import { and, eq, or } from 'drizzle-orm';
import { tcheckFriends } from "./user/friend";

type Event = "message" | "disconnect";
type Handler = (data?: any) => void;

type ClientId = string;
type Client = {
	sockets: WebSocket[],
	onMessage: Handler[],
	onDisconnect: (() => void)[],
	lastOnlineTime: number,
};
type BaseMessage = {
	topic: string;
};
type MatchMessage = BaseMessage & {
	source: string;
	match: number;
	opponent: string;
};

type VersusMessage = BaseMessage & {
	source: string;
	content: string;
}

type Message = BaseMessage | MatchMessage | VersusMessage;

export const clients: Map<ClientId, Client> = new Map();

export function isOnline(id: ClientId) {
	const client = clients.get(id);
	if (!client) return false;
	for (const socket of client.sockets) {
		if (socket.readyState === WebSocket.OPEN) {
			client.lastOnlineTime = Date.now();
			return true;
		}
	}
}

export async function connect(uuid: ClientId, socket: WebSocket) {
	if (!clients.has(uuid)) {
		clients.set(uuid, {
			sockets: [],
			onMessage: [],
			onDisconnect: [],
			lastOnlineTime: 0,
		});
	}
	const client = clients.get(uuid)!;
	client.sockets.push(socket);
	client.lastOnlineTime = Date.now();

	socket.addEventListener("message", (event) => onMessage(client, uuid , event));
	socket.addEventListener("close", () => disconnect(uuid, socket));
}

function updateOnlineTime(client: Client) {
	client.lastOnlineTime = Date.now();
}
async function onMessage(client: Client, clientId : ClientId, event: MessageEvent) {
	updateOnlineTime(client);
	try {
		const msg = JSON.parse(event.data);
		if (msg.source === "ping") return;
		client.onMessage.forEach((handler) => handler(msg));
		switch (msg.topic)
		{
			case("vs:invite") :
				if (!isOnline(msg.content))
					return; 
				const [displaySender] = await db.select({displayName : users.displayName}).from(users).where(eq(users.uuid, clientId ));
				if (!displaySender)
					return;
				send(msg.content, {source: clientId, topic : "vs:invite", content: displaySender.displayName})
				break;
			case ("vs:accept") :
				createMatchBetween(clientId, msg.content);
				break;
			
			case("vs:decline") :
				send(msg.content, {source: clientId, topic : "vs:decline", content:""})
				break;
		}
	} catch (_) {
	}
}

export function send(target: ClientId, message: Message) {
	if (isOnline(target)) {
		try {
			const data = JSON.stringify(message);
			clients.get(target)!.sockets.forEach(socket => socket.send(data));
		} catch (err) {}
	}
}

export function addListener(clientId: ClientId, event: Event, handler: Handler) {
	const client = clients.get(clientId);
	if (!client) return;

	if (event == "message") {
		client.onMessage.push(handler);
	} else if (event == "disconnect") {
		client.onDisconnect.push(handler);
	}
}

/**
 * Closes all of client websockets, or the one specified.
 * Uses the error code 4001 to manifest a voluntary disconnection.
 */
export function disconnect(target: ClientId, socket?: WebSocket) {
	const client = clients.get(target);
	if (!client) return;
	if (socket && socket.readyState === WebSocket.OPEN) {
		client.sockets = client.sockets.filter(e => e != socket);
		if (client.sockets.length == 0) {
			client.lastOnlineTime = Date.now();
		}
		socket.close(4001);
	} else {
		client.sockets.forEach(e => e.close(4001));
		client.sockets = [];
	}
	if (!isOnline(target)) {
		client.onDisconnect.forEach((handler) => handler());
	}
}

async function createMatchBetween(uuid1: string, uuid2 : string) {
	const [p1] = await db.select().from(users).where(eq(users.uuid, uuid1));
	const [p2] = await db.select().from(users).where(eq(users.uuid, uuid2));


	if (!p1 || !p2)
	{
		send(uuid1,{source : "server", topic: "vs:error", content : "User not find ! "});
		send(uuid2,{source : "server", topic: "vs:error", content : "User not find !"});
		return;
	}

	if (await !tcheckFriends(p1.id, p2.id))
	{
		send(uuid1,{source : "server", topic: "vs:error", content : "Users aren't friends anymore !"});
		send(uuid2,{source : "server", topic: "vs:error", content : "Users aren't friends anymore !"});
		return;
	}

	const matchAlreadyGoing = await db.select().from(matches).where(and(or(
		eq(matches.player1Id, p1.id),
		eq(matches.player1Id, p2.id),
		eq(matches.player2Id, p1.id),
		eq(matches.player2Id, p2.id),
	),
	or(eq(matches.status, "ongoing"), eq(matches.status, "pending"))
	));

	if (matchAlreadyGoing.length > 0)
	{
		send(uuid1,{source : "server", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		send(uuid2,{source : "server", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		return;
	}


	const [match] = await db.insert(matches).values({
		player1Id : p1.id,
		player2Id : p2.id,
		status: "pending",
	}).returning();

	send(uuid1, {source: "server", topic : "vs:start", match:match.id, opponent : p2.username});
	send(uuid2, {source: "server", topic : "vs:start", match:match.id, opponent : p1.username});

}

export default {
	clients,
	isOnline,
	send,
	connect,
	disconnect,
	addListener,
};

/*

//MY CONNECT AND DISCONNECT FUNCTION

export async function connect(clientId: ClientId, socket: WebSocket) {
	console.log("[socket]", "connect", clientId);
	socket.addEventListener("close", () => disconnect(clientId, socket));
	if (!clients.has(clientId)) {
		clients.set(clientId, { sockets: [], nbConnections : 0 });
	}
	clients.get(clientId)!.sockets.push(socket);
	clients.get(clientId)!.nbConnections++;

	try {
		if (clients.get(clientId)!.nbConnections === 1)
			await db.update(users).set({ isOnline: 1 }).where(eq(users.uuid, clientId));
	}
	catch {
		console.log("Error while setting isOnline to 1");
	}
	socket.addEventListener("message", (ev) => onMessage(clientId, ev));
}
	*/ 

/*export function disconnect(target: ClientId, socket?: WebSocket) {
	const client = clients.get(target);
	if (!client) return;
	if (socket && socket.readyState === WebSocket.OPEN) {
		client.sockets = client.sockets.filter(e => e != socket);
		client.nbConnections--;
		socket.close(4001);
	} else {
		client.nbConnections = 0;
		client.sockets.forEach(e => e.close(4001));
		clients.delete(target);
	}

	try {
		if (client.nbConnections <= 0) {
			client.nbConnections = 0;
			await db.update(users).set({ isOnline: 0 }).where(eq(users.uuid, target));
		}
	}
	catch {
		console.log("Error while setting isOnline to 0");
	}
}*/