import { api, Status } from "../api.js";
import { notify } from "./utils/notifs.js";

type Message = {
	source: string;
	target: string;
	content: string 
};

export class FriendChat {
	ws: WebSocket | null = null;
	messages: Message[] = [];
	username: string = "";
	targetUsername: string = "";
	currentRoomId : string | null = null;
	lastMessage = 0;
	isActive = false;

	async connect(url: string) {
		this.isActive = true;
		if (this.ws)
			return this.ws;
		const me = await api.get("/api/me");
		if (!me || !me.payload ||me.status!==Status.success)
			return alert("Error API me");
		this.username = me.payload.username;
		return new Promise<WebSocket>((resolve, reject) => {
			this.ws = new WebSocket(url);

			this.ws.addEventListener("open", () =>{
				resolve(this.ws!);
			}); 

			this.ws.addEventListener("message", (event) => {
				try {
					if (!this.isActive)
						return;
					const msg: Message = JSON.parse(event.data);
					this.messages.push(msg);
				}
				catch (err) {
					console.error("WebSocket message parse error:", err);
				}
			});

			this.ws.addEventListener("close", () => {
				this.ws = null;
				this.username = "";
			});

			this.ws.addEventListener("error", (err) => reject(err));
		});

		
	}

	send(msg: string)
	{
		if (!this.ws || !this.currentRoomId)
			return;
		this.ws.send(JSON.stringify({target:this.currentRoomId,content:msg}));
	}

	reset(){
		this.disconnect();
		this.messages = [];
		this.targetUsername = "";
		this.isActive = false;
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
		this.username = "";
		this.currentRoomId = null;
		this.lastMessage = 0;
	}

	async openRoom(username : string)
	{
		const Roomres = await api.post(`/api/chat/private/${username}`);
		if (!Roomres || Roomres.status !== Status.success) {
			notify("Room error", "error");
			return;
		}
		this.currentRoomId = Roomres.payload.roomId;
		this.targetUsername = username;
		this.lastMessage = 0;
		return this.currentRoomId;
	}

	async loadHistory() {
		if (!this.currentRoomId)
			return;

		this.messages = [];
		const res = await api.get(`/api/chat/room/${this.currentRoomId}/message`);
		if (!res ||res.status !== Status.success)
			return;

		this.messages.push(...res?.payload);
	}

	getRoomMessages(): Message[] {
		if (!this.currentRoomId)
			return [];
		return this.messages.filter(mess => mess.target === this.currentRoomId);
	}


	cleanRoomState(){
		this.messages = [];
		this.currentRoomId = null;
		this.lastMessage = 0;
		this.targetUsername = "";
	}
}