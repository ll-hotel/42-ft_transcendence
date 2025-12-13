import { v4 as uuidv4 } from "uuid";
import { FastifyInstance } from "fastify";

export function chatRoute(fastify: FastifyInstance) {
	fastify.get("/api/chat", { websocket: true }, wsConnected);
}

class ChatUser {
	readonly id: string;
	readonly ws: WebSocket;
	lastPingMs: number;
	room: ChatRoom;

	constructor(uuid: string, ws: WebSocket, room: ChatRoom) {
		this.id = uuid;
		this.ws = ws;
		this.lastPingMs = Date.now();
		this.room = room;

		this.ws.onmessage = (event: MessageEvent<string>) => {
			if (event.data.length == 0 || event.data.length > 200) {
				this.lastPingMs = 0;
				return;
			}
			if (event.data == "pong") {
				this.lastPingMs = Date.now();
				return;
			}
			this.room.broadcast(this.id, event.data);
		};
	}
	isAlive(timeMs: number): boolean {
		if (this.ws.readyState == WebSocket.CLOSED) return false;
		if (this.ws.readyState == WebSocket.CLOSING) return false;
		if (timeMs - this.lastPingMs >= 20 * 1000) return false;
		return true;
	}
};

class ChatRoom {
	readonly id: string;
	users: ChatUser[];

	constructor(id: string = uuidv4()) {
		this.id = id;
		this.users = [];
		const pingLoop = () => {
			this.pingUsers();
			setTimeout(pingLoop, 5 * 1000);
		};
		pingLoop();
	}
	broadcast(origin: string, text: string) {
		const message = {
			origin,
			text,
		};
		for (const user of this.users) {
			user.ws.send(JSON.stringify(message));
		}
	}
	connectUser(ws: WebSocket): ChatUser {
		const user = new ChatUser(uuidv4(), ws, this);
		user.room = this;
		this.users.push(user);
		this.broadcast(user.id, "Joined");

		console.log(JSON.stringify({ origin: "gamechat", text: `${this.id} connected` }));
		return user;
	}
	private pingUsers() {
		const now = Date.now();

		const alives = this.users.filter(user => user.isAlive(now));
		const deads = this.users.filter(user => !user.isAlive(now));
		for (const user of deads) {
			if (user.ws.readyState == WebSocket.CLOSED) continue;
			this.broadcast(user.id, "Disconnected");
			user.ws.close();
		}
		this.users = alives;
		this.broadcast("", "ping");
	}
};

const chat = new ChatRoom();

function wsConnected(ws: WebSocket) {
	chat.connectUser(ws);
}
