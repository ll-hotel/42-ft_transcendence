type ClientId = number;
type Client = {
	socket: WebSocket,
}
type BaseMessage = {
	source: string,
	type: string,
};
type MatchMessage = BaseMessage & {
	match: number,
	opponent: string,
};
type Message = BaseMessage | MatchMessage;

export const clients: Map<ClientId, Client> = new Map();

export function isAlive(client: ClientId) {
	return clients.has(client) && clients.get(client)!.socket.readyState == WebSocket.OPEN;
}

export function connect(clientId: ClientId, socket: WebSocket) {
	console.log("[socket]", "connect", clientId);
	socket.addEventListener("close", () => disconnect(clientId));
	clients.set(clientId, { socket });
	socket.addEventListener("message", (ev) => {
		try {
			const json = JSON.parse(ev.data);
			console.log("[socket]", "message", clientId, json);
		} catch (_) {
			if (ev.data) {
				console.log("[socket]", "message", clientId, ev.data);
			}
		}
	})
}

export function send(target: ClientId, message: Message) {
	if (isAlive(target)) {
		console.log("[socket]", "send", target, message);
		clients.get(target)!.socket.send(JSON.stringify(message));
	}
}

export function disconnect(target: ClientId) {
	console.log("[socket]", "disconnect", target);
	let client: Client | undefined;
	if (client = clients.get(target)) {
		clients.delete(target);
		client.socket.close();
	}
}

export default {
	clients,
	isAlive,
	send,
	connect,
	disconnect
};
