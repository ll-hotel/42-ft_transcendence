import { api, Status } from "../api.js";
import socket from "../socket.js";
import { notify } from "../utils/notifs.js";

type Message = {
	source: string,
	target: string,
	content: string,
};

export class FriendChat {
	ws: WebSocket | null = null;
	messages: Message[] = [];
	username: string = "";
	targetUsername: string = "";
	currentRoomId: string | null = null;
	lastMessage = 0;
	isActive = false;

	async connect(): Promise<WebSocket | null> {
		this.isActive = true;
		if (this.ws) {
			return this.ws;
		}
		const me = await api.get("/api/user/me");
		if (!me || !me.payload || me.status !== Status.success) {
			notify("API error", "error");
			return null;
		}
		this.username = me.payload.username;
		return new Promise<WebSocket | null>(async (resolve) => {
			const ping = await api.get("/api/chat/ping");
			if (!ping || !ping.payload || ping.status !== Status.success) {
				notify("API error", "error");
				return null;
			}
			const connected = await socket.connect();
			if (!connected) {
				this.disconnect();
			}
			this.ws = socket.conn!;
			socket.addListener("chat", (msg) => {
				this.messages.push(msg as unknown as Message);
			});
			this.ws.addEventListener("close", () => this.disconnect());
			this.ws.addEventListener("error", () => this.disconnect());
			resolve(this.ws);
		});
	}

	send(msg: string): void {
		if (!this.ws || !this.currentRoomId) {
			return;
		}
		this.ws.send(JSON.stringify({ service: "chat", target: this.currentRoomId, content: msg }));
	}

	reset(): void {
		this.disconnect();
		this.messages = [];
		this.targetUsername = "";
		this.isActive = false;
	}

	disconnect(): void {
		this.ws = null;
		this.username = "";
		this.currentRoomId = null;
		this.lastMessage = 0;
	}

	async openRoom(username: string): Promise<string | null> {
		const Roomres = await api.post(`/api/chat/private/${username}`);
		if (!Roomres || Roomres.status !== Status.success) {
			notify("Room error", "error");
			return null;
		}
		this.currentRoomId = Roomres.payload.roomId;
		this.targetUsername = username;
		this.lastMessage = 0;
		return this.currentRoomId;
	}

	async loadHistory(): Promise<void> {
		if (!this.currentRoomId) {
			return;
		}

		this.messages = [];
		const res = await api.get(`/api/chat/room/${this.currentRoomId}/message`);
		if (!res || res.status !== Status.success) {
			return;
		}

		this.messages.push(...res?.payload);
	}

	getRoomMessages(): Message[] {
		if (!this.currentRoomId) {
			return [];
		}
		return this.messages.filter(mess => mess.target === this.currentRoomId);
	}

	cleanRoomState(): void {
		this.messages = [];
		this.currentRoomId = null;
		this.lastMessage = 0;
		this.targetUsername = "";
	}
}
