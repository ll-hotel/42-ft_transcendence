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
	export type Message = BaseMessage;

	export const clients: Map<UUID, Client> = new Map();

	export function isOpen(id: UUID): boolean {
		const client = clients.get(id);
		if (client && client.conn.readyState == Ws.OPEN) {
			return true;
		}
		return false;
	}

	export async function register(uuid: UUID, conn: Ws.WebSocket) {
		if (!clients.has(uuid)) {
			clients.set(uuid, { conn: conn, onmessage: [] });
		}
		const client = clients.get(uuid)!;
		conn.on("message", (stream) => dispatch(client, stream.toString()));
		conn.on("close", () => disconnect(uuid));
	}

	function dispatch(client: Client, data: string) {
		try {
			const msg = JSON.parse(data);
			if (!msg.topic || msg.topic === "ping") {
				return;
			}
			client.onmessage.filter(cb => (!cb.topic) || cb.topic == msg.topic).forEach(cb => cb.fn(msg));
		} catch {}
	}

	export function send(uuid: UUID, message: Message) {
		if (isOpen(uuid)) {
			try {
				const data = JSON.stringify(message);
				clients.get(uuid)!.conn.send(data);
			} catch {}
		}
	}

	/** For compatibility */
	export function disconnect(uuid: UUID, _?: any) {
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
	export function addListener(uuid: UUID, topic: string, fn: MessageFn | CloseFn | TopicFn) {
		const client = clients.get(uuid);
		if (client) {
			if (topic == "message") client.conn.addEventListener("message", fn as MessageFn);
			else if (topic == "close" || topic == "disconnect") client.conn.on("close", fn as CloseFn);
			else client.onmessage.push({ topic, fn: fn as TopicFn });
		}
	}
	export function onmessage(uuid: UUID, fn: TopicFn) {
		const client = clients.get(uuid);
		if (client) {
			client.onmessage.push({ fn });
		}
	}
}
export default Socket;
