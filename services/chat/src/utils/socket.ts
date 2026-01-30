import * as Ws from "ws";
import * as orm from "drizzle-orm";
import { db } from "./db/database";
import * as tables from "./db/tables";
import { createMatch1vs1 } from "./versus";


type HandlerFn = (data?: any) => void;
type UUID = string;
type Client = {
	sockets: Ws.WebSocket[],
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
		if (socket.readyState === Ws.WebSocket.OPEN) {
			client.lastOnlineTime = Date.now();
			return true;
		}
	}
	return false;
}

export async function connect(uuid: UUID, socket: Ws.WebSocket) {
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

	socket.on("message", (data) => onMessage(client, data));
	socket.on("close", () => disconnect(uuid, socket));

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
function onMessage(client: Client, data: Ws.RawData) {
	updateOnlineTime(client);
	try {
		const msg = JSON.parse(data.toString());
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

export function disconnect(uuid: UUID, socket?: Ws.WebSocket) {
	const client = clients.get(uuid);
	if (!client) return;
	if (socket && socket.readyState === Ws.WebSocket.OPEN) {
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

export default {
	clients,
	isOnline,
	send,
	connect,
	disconnect,
	addListener,
	removeListener,
};
