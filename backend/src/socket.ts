type ClientId = string;
type Client = {
	sockets: WebSocket[];
};
type BaseMessage = {
	source: string;
	type: string;
};
type MatchMessage = BaseMessage & {
	match: number;
	opponent: string;
};
type Message = BaseMessage | MatchMessage;

export const clients: Map<ClientId, Client> = new Map();

export function isAlive(client: ClientId) {
	if (!clients.has(client)) return false;
	for (const socket of clients.get(client)!.sockets) {
		if (socket.readyState != socket.CLOSING) return true;
	}
	return false;
}

export function connect(clientId: ClientId, socket: WebSocket) {
	console.log("[socket]", "connect", clientId);
	socket.addEventListener("close", () => disconnect(clientId, socket));
	if (!clients.has(clientId)) {
		clients.set(clientId, { sockets: [] });
	}
	clients.get(clientId)!.sockets.push(socket);
	socket.addEventListener("message", (ev) => onMessage(clientId, ev));
}

function onMessage(clientId: ClientId, ev: MessageEvent) {
	try {
		const json = JSON.parse(ev.data);
		if (json.source != "ping") {
			console.log("[socket]", "message", clientId, json);
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
export function disconnect(target: ClientId, socket?: WebSocket) {
	console.log("[socket]", "disconnect", target);
	const client = clients.get(target);
	if (!client) return;
	if (socket) {
		client.sockets = client.sockets.filter(e => e != socket);
		socket.close(4001);
	} else {
		clients.delete(target);
		client.sockets.forEach(e => e.close(4001));
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
