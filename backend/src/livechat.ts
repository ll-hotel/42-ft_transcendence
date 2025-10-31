import { v4 as uuidv4 } from "uuid";
import { FastifyInstance, FastifyRequest } from "fastify";

export function liveChatModule(fastify: FastifyInstance) {
	fastify.get("/api/chat", { websocket: true }, wsConnected);
}

class ChatUser {
	readonly id: string;
	readonly ws: WebSocket;
	private lastPingMs: number;
	room: ChatRoom;

	constructor(uuid: string, ws: WebSocket, room: ChatRoom) {
		this.id = uuid;
		this.ws = ws;
		this.lastPingMs = 0;
		this.room = room;

		this.ws.onmessage = (message) => {
			this.lastPingMs = new Date().getTime();
			if (message.data == "/ping") {
				ws.send("/pong");
			} else {
				chat.users.forEach((elt) => elt.ws.send(message.data));
			}
		};
		this.ws.onclose = () => {
			const idx = chat.users.findIndex((elt) => elt.id == this.id);
			chat.users = chat.users.splice(idx, 1);
		};
		this.startPing();
	}
	private startPing() {
		const now = new Date().getTime();
		if (now - this.lastPingMs < 120 * 1000) {
			setTimeout(this.startPing, 40 * 1000);
			return;
		}
		this.room.disconnectById(this.id);
	}
};

class ChatRoom {
	readonly id: string;
	users: ChatUser[];

	constructor(id: string = uuidv4()) {
		this.id = id;
		this.users = [];
	}
	broadcast(msg: any) {
		for (const user of this.users) {
			user.ws.send(msg);
		}
	}
	connectUser(ws: WebSocket): ChatUser {
		const user = new ChatUser(uuidv4(), ws, this);
		user.room = this;
		this.broadcast(`${user.id} joined.`);
		this.users.push(user);

		console.log({ origin: "gamechat", text: `${this.id} connected` });
		return user;
	}
	disconnectById(id: string) {
		const pos = this.users.findIndex((user) => user.id === id);
		if (pos >= 0) {
			const user = this.users.splice(pos, 1)[0];
			user.ws.send("Disconnected");
			user.ws.close();

			console.log({ origin: "gamechat", text: `${this.id} disconnected` });
		}
	}
};

const chat = new ChatRoom();

function wsConnected(ws: WebSocket, req: FastifyRequest) {
	chat.connectUser(ws);
}
