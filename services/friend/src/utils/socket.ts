import { and, eq, or } from "drizzle-orm";
import { db } from "./db/database";
import { friends, matches, users } from "./db/tables";

export async function tcheckFriends(user_1: number, user_2: number): Promise<boolean> {
	const res = await db.select({ id: friends.id }).from(friends).where(and(
		eq(friends.status, "accepted"),
		or(
			and(
				eq(friends.senderId, user_1),
				eq(friends.receiverId, user_2),
			),
			and(
				eq(friends.senderId, user_2),
				eq(friends.receiverId, user_1),
			),
		),
	)).limit(1);
	return res.length > 0;
}

import * as Ws from "ws";

type UUID = string;

namespace Socket {
	export type Callback = {
		topic?: string,
		fn: Socket.TopicFn,
	};
	export type Client = {
		conn: Ws.WebSocket,
		onmessage: Callback[],
	};
	export type BaseMessage = {
		topic: string,
	};
	export type ChatMessage = BaseMessage & {
		source: string,
		target: string,
		content: string,
	};
	export type Message = BaseMessage | ChatMessage;

	export const clients: Map<UUID, Client> = new Map();

	export function isOpen(id: UUID): boolean {
		const client = clients.get(id);
		if (client && client.conn.readyState == Ws.OPEN) {
			return true;
		}
		return false;
	}
	export const isOnline = isOpen;

	export function register(uuid: UUID, conn: Ws.WebSocket): void {
		if (!clients.has(uuid)) {
			clients.set(uuid, { conn: conn, onmessage: [] });
		}
		const client = clients.get(uuid)!;
		conn.on("message", (stream) => dispatch(client, stream.toString()));
		conn.on("close", () => disconnect(uuid));
		addListener(uuid, "vs:invite", (m: any) => {
			const msg = m as ChatMessage;
			if (!isOnline(msg.target)) {
				return;
			}
			send(msg.target, { source: uuid, topic: "vs:invite", target: msg.target });
		});
		addListener(uuid, "vs:accept", (m: any) => {
			const msg = m as ChatMessage;
			createMatchBetween(uuid, msg.target);
		});

		addListener(uuid, "vs:decline", (m: any) => {
			const msg = m as ChatMessage;
			send(msg.target, { source: uuid, topic: "vs:decline", target: msg.target });
		});
	}
	export const connect = register;

	function dispatch(client: Client, data: string): void {
		try {
			const msg = JSON.parse(data);
			if (!msg.topic || msg.topic === "ping") {
				return;
			}
			client.onmessage.filter(cb => (!cb.topic) || cb.topic == msg.topic).forEach(cb => cb.fn(msg));
		} catch {}
	}

	export function send(uuid: UUID, message: Message): void {
		if (isOpen(uuid)) {
			try {
				const data = JSON.stringify(message);
				clients.get(uuid)!.conn.send(data);
			} catch {}
		}
	}
	export function sendRaw(uuid: UUID, data: string): void {
		const client = clients.get(uuid);
		if (client) {
			client.conn.send(data);
		}
	}

	/** For compatibility */
	export function disconnect(uuid: UUID, _?: any): void {
		close(uuid);
	}
	export function close(uuid: UUID): void {
		const client = clients.get(uuid);
		if (client) {
			if (client.conn.readyState == Ws.WebSocket.OPEN) {
				client.conn.close();
			}
			clients.delete(uuid);
		}
	}

	export type MessageFn = (event: Ws.MessageEvent) => void;
	export type CloseFn = (code?: number, reason?: any) => void;
	export type TopicFn = (json: Message) => void;
	export function addListener(uuid: UUID, topic: string, fn: MessageFn | CloseFn | TopicFn): void {
		const client = clients.get(uuid);
		if (client) {
			if (topic == "message") client.conn.addEventListener("message", fn as MessageFn);
			else if (topic == "close" || topic == "disconnect") client.conn.on("close", fn as CloseFn);
			else client.onmessage.push({ topic, fn: fn as TopicFn });
		}
	}
	export function onmessage(uuid: UUID, fn: TopicFn): void {
		const client = clients.get(uuid);
		if (client) {
			client.onmessage.push({ fn });
		}
	}
}
export default Socket;

async function createMatchBetween(uuid1: string, uuid2: string) {
	const [p1] = await db.select().from(users).where(eq(users.uuid, uuid1));
	const [p2] = await db.select().from(users).where(eq(users.uuid, uuid2));

	if (!p1 || !p2) {
		return;
	}

	if (!tcheckFriends(p1.id, p2.id)) {
		console.log("They aren't friend anymore, so we can't create a game, sorry :(");
		return;
	}

	const matchAlreadyGoing = await db.select().from(matches).where(and(
		or(
			eq(matches.player1Id, p1.id),
			eq(matches.player1Id, p2.id),
			eq(matches.player2Id, p1.id),
			eq(matches.player2Id, p2.id),
		),
		eq(matches.status, "ongoing"),
	));

	if (matchAlreadyGoing.length > 0) {
		console.log("Someone is already on a match, sorry :(");
		return;
	}

	const [match] = await db.insert(matches).values({
		player1Id: p1.id,
		player2Id: p2.id,
		status: "ongoing",
	}).returning();

	const msg1 = { source: "server", topic: "vs:start", match: match.id, opponent: p2.username };
	Socket.send(uuid1, msg1);
	const msg2 = { source: "server", topic: "vs:start", match: match.id, opponent: p1.username };
	Socket.send(uuid2, msg2);
}
