import { SingleStoreColumnWithAutoIncrement } from "drizzle-orm/singlestore-core";
import { appendFile } from "fs";
import { matches, users } from './db/tables';
import { db } from './db/database';
import { and, eq, or } from 'drizzle-orm';
import { matchesGlob } from "path";
import user from "./user/user";
import { ucs2 } from "punycode";
import { tcheckFriends } from "./user/friend";
import { TableAliasProxyHandler } from "drizzle-orm";

type ClientId = string;
type Client = {
	sockets: WebSocket[];
	nbConnections: number;
};
type BaseMessage = {
	source: string;
	type: string;
};
type MatchMessage = BaseMessage & {
	match: number;
	opponent: string;
};

type VersusMessage = BaseMessage & {
	target: string;
}



type Message = BaseMessage | MatchMessage | VersusMessage;


async function createMatchBetween(uuid1: string, uuid2 : string) {
	const [p1] = await db.select().from(users).where(eq(users.uuid, uuid1));
	const [p2] = await db.select().from(users).where(eq(users.uuid, uuid2));

	if (!p1 || !p2)
		return;

	if (await !tcheckFriends(p1.id, p2.id))
	{
		console.log("They aren't friend anymore, so we can't create a game, sorry :(");
		return;
	}

	const matchAlreadyGoing = await db.select().from(matches).where(and(or(
		eq(matches.player1Id, p1.id),
		eq(matches.player1Id, p2.id),
		eq(matches.player2Id, p1.id),
		eq(matches.player2Id, p2.id),
	),
	eq(matches.status, "ongoing"),
	));

	if (matchAlreadyGoing.length > 0)
	{
		console.log("Someone is already on a match, sorry :(");
		return;
	}


	const [match] = await db.insert(matches).values({
		player1Id : p1.id,
		player2Id : p2.id,
		status: "ongoing",
	}).returning();

	send(uuid1, {source: "server", type : "vs:start", match:match.id, opponent : p2.username,});
	send(uuid2, {source: "server", type : "vs:start", match:match.id, opponent : p1.username,});

}

export const clients: Map<ClientId, Client> = new Map();

export function isAlive(client: ClientId) {
	if (!clients.has(client)) return false;
	for (const socket of clients.get(client)!.sockets) {
		if (socket.readyState === WebSocket.OPEN) return true;
	}
	return false;
}

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

function onMessage(clientId: ClientId, ev: MessageEvent) {
	try {
		const msg = JSON.parse(ev.data);
		if (msg.source != "ping") {
			console.log("[socket]", "message", clientId, msg);
		}
		switch (msg.type)
		{
			case("vs:invite") :
				if (!isAlive(msg.target))
					return; 
				send(msg.target, {source: clientId, type : "vs:invite", target: msg.target})
				break;
			case ("vs:accept") :
				createMatchBetween(clientId, msg.target);
				break;
			
			case("vs:decline") :
				send(msg.target, {source: clientId, type : "vs:decline", target:msg.target})
				break;
		}
	} catch (_) {
		if (ev.data) {
			console.log("[socket]", "message", clientId, '"' + ev.data + '"');
		}
	}
}

export function send(target: ClientId, message: Message) {
	if (isAlive(target)) {
		console.log("[socket]", "send", target, message);
		try {
			const data = JSON.stringify(message);
			clients.get(target)!.sockets.forEach(socket => socket.send(data));
		} catch (err) {}
	}
}
export function addListener(client: ClientId, event: string, hook: () => void) {
	if (clients.has(client)) {
		clients.get(client)!.sockets.forEach(s => s.addEventListener(event, hook));
	}
}

/**
 * Closes all of client websockets, or the one specified.
 * Uses the error code 4001 to manifest a voluntary disconnection.
 */
export async function disconnect(target: ClientId, socket?: WebSocket) {
	console.log("[socket]", "disconnect", target);
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
}

export default {
	clients,
	isAlive,
	send,
	connect,
	disconnect,
	addListener,
};
