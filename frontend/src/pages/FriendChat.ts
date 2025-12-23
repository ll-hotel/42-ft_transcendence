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
	currentRoomId : string | null = null;
	lastMessage = 0;

	async connect(url: string) {
		if (this.ws)
			return this.ws;
		return new Promise<WebSocket>((resolve) => {
			this.ws = new WebSocket(url);

			this.ws.addEventListener("message", (event) => {
				try {
					const msg: Message = JSON.parse(event.data);
					this.messages.push(msg);
					if (!this.username)
						this.username = msg.source;
				}
				catch {}
			});

			this.ws.addEventListener("close", () => {
				this.ws = null;
				this.username = "";
			});
		});
	}

	send(msg: string)
	{
		if (!this.ws || !this.currentRoomId)
			return;
		this.ws.send(JSON.stringify({source: this.username, target: this.currentRoomId, msg,}));
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
		this.username = "";
	}

	async openRoom(username : string)
	{
		const Roomres = await api.get(`/api/chat/private/${username}`);
		if (!Roomres || Roomres.status !== Status.success) {
			alert("Room didnt work");
			return;
		}
		this.currentRoomId = Roomres.payload.roomId;
		this.lastMessage = 0;
		return this.currentRoomId;
	}
	getRoomMessages(): Message[] {
		if (!this.currentRoomId)
			return [];
		return (this.messages.filter((msg: Message) => msg.target === this.currentRoomId));

	}
}