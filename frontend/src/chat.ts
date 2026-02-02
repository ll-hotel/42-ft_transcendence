import { api, Status } from "./api.js";
import { loader } from "./PageLoader.js";
import socket, { ChatMessage } from "./socket.js";
import { notify } from "./utils/notifs.js";

export class Chat {
	ws: WebSocket | null = null;
	messages: ChatMessage[] = [];
	username: string = "";
	targetUsername: string = "";
	currentRoomId: string | null = null;
	lastMessage = 0;
	connected: boolean = false;

	notifyDaemon: NotifyDaemon = new NotifyDaemon();

	constructor() {
		socket.addListener("chat", (msg) => {
			this.messages.push(msg as unknown as ChatMessage);
		});
		this.notifyDaemon.start();
	}

	async connect(): Promise<boolean> {
		const ping = await api.get("/api/chat/ping");
		if (!ping || !ping.payload || ping.status !== Status.success) {
			notify("API error", "error");
			return false;
		}
		const conn = await new Promise<WebSocket | null>(async (resolve) => {
			const ping = await api.get("/api/chat/ping");
			if (!ping || !ping.payload || ping.status !== Status.success) {
				notify("API error", "error");
				return resolve(null);
			}
			const connected = await socket.connect();
			if (connected) {
				resolve(socket.conn!);
			} else {
				resolve(null);
			}
		});
		if (!conn) {
			return false;
		}
		this.ws = conn;
		if (!this.connected) {
			this.connected = true;
			this.ws.addEventListener("close", () => this.disconnect());
			this.ws.addEventListener("error", () => this.disconnect());
		}
		this.username = "Unknown";
		const me = await api.get("/api/user/me");
		if (!me || !me.payload || me.status !== Status.success) {
			notify("API error", "error");
		} else {
			this.username = me.payload.username;
		}
		return true;
	}

	async send(msg: string): Promise<void> {
		if (!this.currentRoomId) return;

		const roomId = this.currentRoomId;
		this.connect().then(() => {
			socket.send({ service: "chat", topic: "chat", source: "@" + this.username, target: roomId, content: msg });
		});
	}

	reset(): void {
		this.disconnect();
		this.messages = [];
		this.targetUsername = "";
	}

	disconnect(): void {
		this.ws = null;
		this.username = "";
		this.currentRoomId = null;
		this.lastMessage = 0;
		this.connected = false;
	}

	async openRoom(username: string): Promise<string | null> {
		const roomResponse = await api.post(`/api/chat/private/${username}`);
		if (!roomResponse) return null;
		if (roomResponse.status !== Status.success) {
			notify(roomResponse.payload.message, "error");
			return null;
		}
		this.currentRoomId = roomResponse.payload.roomId;
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

	getRoomMessages(): ChatMessage[] {
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

class NotifyDaemon {
	started: boolean = false;
	restartInterval: number | null = null;

	start(): void {
		if (this.started) {
			return;
		}
		this.started = true;
		socket.addListener("chat", (m) => {
			const chatMsg = m as unknown as ChatMessage;

			if (loader.loaded != "chat") {
				notify("New message from " + chatMsg.source.slice(1), "info", 1000);
			}
		});
		socket.connect().then((success) => {
			if (!success) {
				return this.restart();
			}
			socket.conn!.addEventListener("close", () => this.restart());
		});
	}
	stop(): void {
		if (!this.started) {
			return;
		}
		this.started = false;
	}
	restart(): void {
		if (this.restartInterval != null) {
			return;
		}
		this.stop();
		this.restartInterval = setInterval(() => {
			if (socket.isAlive()) {
				this.start();
				if (this.restartInterval) clearInterval(this.restartInterval);
				this.restartInterval = null;
			}
		}, 500);
	}
}
