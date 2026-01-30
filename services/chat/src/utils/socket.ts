import * as Ws from "ws";

type UUID = string;
export type Callback = {
	topic?: string,
	fn: Socket.TopicFn,
};
export type Client = {
	conn: Ws.WebSocket,
	onmessage: Callback[],
};
export type BaseMessage = {
	service: string,
	topic: string,
};
export type Message = BaseMessage | (BaseMessage & {
	source: string,
	content: string
}) | (BaseMessage & {
	source: string,
	match: number,
	opponent: string
});

namespace Socket {
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

	export function removeListener(uuid: UUID, topic: string): void {
		const client = clients.get(uuid);
		if (client) {
			client.onmessage = client.onmessage.filter(cb => cb.topic != topic);
		}
	}
}
export default Socket;
