export default socket;

namespace socket {
	export type ClientId = number;
	type Client = {
		socket: WebSocket,
	}
	export type BaseMessage = {
		source: string,
		type: string,
	};
	export type MatchMessage = BaseMessage & {
		match: number,
		opponent: string,
	};
	export type Message = BaseMessage | MatchMessage;

	export const clients: Map<ClientId, Client> = new Map();

	export function isAlive(client: ClientId) {
		return clients.has(client) && clients.get(client)!.socket.readyState == WebSocket.OPEN;
	}

	export function send(target: ClientId, message: Message) {
		if (isAlive(target)) {
			clients.get(target)!.socket.send(JSON.stringify(message));
		}
	}

	export function disconnect(target: ClientId) {
		let client: Client | undefined;
		if (client = clients.get(target)) {
			clients.delete(target);
			client.socket.close();
		}
	}
}
