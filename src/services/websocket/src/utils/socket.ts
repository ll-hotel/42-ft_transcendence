import * as WebSocket from "ws";

type Event = "message" | "disconnect";
type Handler = (data?: any) => void;

type ClientId = string;
type Client = {
	sockets: WebSocket.WebSocket[],
	onMessage: Handler[],
	onDisconnect: (() => void)[],
	lastOnlineTime: number,
};
type BaseMessage = {
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

export const clients: Map<ClientId, Client> = new Map();

export function isOnline(id: ClientId): boolean {
	const client = clients.get(id);
	if (!client) return false;
	for (const socket of client.sockets) {
		if (socket.readyState === WebSocket.WebSocket.OPEN) {
			client.lastOnlineTime = Date.now();
			return true;
		}
	}
	return false;
}

export async function connect(uuid: ClientId, socket: WebSocket.WebSocket) {
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

	socket.addEventListener("message", (event) => onMessage(client, event));
	socket.addEventListener("close", () => disconnect(uuid, socket));
}

function updateOnlineTime(client: Client) {
	client.lastOnlineTime = Date.now();
}

function onMessage(client: Client, event: WebSocket.MessageEvent) {
	updateOnlineTime(client);
	try {
		const msg = JSON.parse(event.data.toString());
		if (msg.source === "ping") return;
		client.onMessage.forEach((handler) => handler(msg));
	} catch {}
}

export function send(target: ClientId, message: Message) {
	if (isOnline(target)) {
		try {
			const data = JSON.stringify(message);
			sendRaw(target, data);
		} catch (err) {}
	}
}

export function sendRaw(target: ClientId, data: any) {
	clients.get(target)!.sockets.forEach(socket => socket.send(data));
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
export function disconnect(target: ClientId, socket?: WebSocket.WebSocket) {
	const client = clients.get(target);
	if (!client) return;
	if (socket && socket.readyState === WebSocket.WebSocket.OPEN) {
		client.sockets = client.sockets.filter(e => e != socket);
		if (client.sockets.length == 0) {
			client.lastOnlineTime = Date.now();
		}
		socket.close(4001);
	} else {
		client.sockets.forEach(socket => socket.close(4001));
		client.sockets = [];
	}
	if (!isOnline(target)) {
		client.onDisconnect.forEach((handler) => handler());
		client.onDisconnect = [];
		client.onMessage = [];
	}
}

export default {
	clients,
	isOnline,
	send,
	sendRaw,
	connect,
	disconnect,
	addListener,
};
