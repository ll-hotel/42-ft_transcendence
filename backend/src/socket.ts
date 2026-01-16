type ClientId = string;
type Client = {
	sockets: WebSocket[],
	onMessage: Handler[],
	onDisconnect: (() => void)[],
	lastOnlineTime: number,
};
type Message = {
	source: string,
	type: string,
};

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
	return false;
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

	socket.addEventListener("message", (event) => onMessage(client, event));
	socket.addEventListener("close", () => disconnect(uuid, socket));
}

function updateOnlineTime(client: Client) {
	client.lastOnlineTime = Date.now();
}
function onMessage(client: Client, event: MessageEvent) {
	updateOnlineTime(client);
	try {
		const json = JSON.parse(event.data);
		if (json.source === "ping") return;
		client.onMessage.forEach((handler) => handler(json));
	} catch (_) {}
}

export function send(target: ClientId, message: Message) {
	if (isOnline(target)) {
		try {
			const data = JSON.stringify(message);
			clients.get(target)!.sockets.forEach(socket => socket.send(data));
		} catch (err) {}
	}
}

type Event = "message" | "disconnect";
type Handler = (data?: any) => void;
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

export default {
	clients,
	isOnline,
	send,
	connect,
	disconnect,
	addListener,
};
