import { api, Status } from "../api.js";

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

	async connect(url: string) {
		if (this.ws)
			return this.ws;
		return new Promise<WebSocket>((resolve, reject) => {
			this.ws = new WebSocket(url);

			this.ws.addEventListener("open", () =>{
				console.log("WebSocket connected");
				resolve(this.ws!);
			}); 

			this.ws.addEventListener("message", (event) => {
				try {
					const msg: Message = JSON.parse(event.data);
					console.log("Received message:", msg, "currentRoomId:", this.currentRoomId);
					this.messages.push(msg);
					if (!this.username)
						this.username = msg.source;
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
		this.ws.send(JSON.stringify({source: this.username,target:this.currentRoomId,content:msg,}));
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
		this.username = "";
	}

	async openRoom(username : string)
	{
		const Roomres = await api.post(`/api/chat/private/${username}`);
		if (!Roomres || Roomres.status !== Status.success) {
			alert("Room didnt work");
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

		const res = await api.get(`/api/chat/messages/${this.currentRoomId}`);
		if (!res ||res.status !== Status.success)
			return;

		this.messages.push(...res?.payload.messages);
	}

	getRoomMessages(): Message[] {
		if (!this.currentRoomId)
			return [];
		return (this.messages.filter((msg: Message) => msg.target === this.currentRoomId));

	}

	cleanRoomState(){
		this.currentRoomId = null;
		this.lastMessage = 0;
		this.targetUsername = "";
	}
}