//PLUS UTILISÉ

import { api } from "../api.js";
import AppPage from "./AppPage.js";

type Message = {
	source: string;
	target: string;
	content: string 
};

class Chat {
	ws: WebSocket | null = null;
	messages: Message[] = [];
	username: string = "";

	async connect(url: string) {
		if (this.ws) return this.ws;
		return new Promise<WebSocket>((resolve) => {
			this.ws = new WebSocket(url);

			this.ws.addEventListener("open", () => resolve(this.ws!));

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

	send(msg: Message)
	{
		if (!this.ws) return;
		this.ws.send(JSON.stringify(msg));
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
		this.username = "";
	}
}

export class ChatElement implements AppPage {
	html: HTMLElement;
	chat: Chat;
	currentRoomId: string | null;
	lastMessage: number;

	private constructor(html: HTMLElement) {
		this.html = html;
		this.chat = new Chat();
		this.currentRoomId = null;
		this.lastMessage = 0;
	}

	static new(html: HTMLElement): ChatElement | null {
		const form: HTMLFormElement | null = html.querySelector("form#chat-input");

		if (!form)
			return null;
		
		const input: HTMLInputElement | null = form.querySelector('input[name="input"]');
		const target: HTMLInputElement | null = form!.querySelector('input[name="target"]');

		if (!input || !target) 
			return null;

		const page = new ChatElement(html);

		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (!input.value || !target.value) return;

			// Création ou récupération de la room privée
			const targetName = target.value.startsWith("@") ? target.value.slice(1) : target.value;
			if (!page.currentRoomId || !page.currentRoomId.includes(targetName))
			{
				try {
					const res = await api.post(`/api/chat/private/${targetName}`);
					if (!res)
						throw new Error;
					const data = await res.payload;
					page.currentRoomId = data.roomId;
					page.lastMessage = 0;
					const chatList = page.html.querySelector("#chat")!;
					chatList.innerHTML = "";
				}
				catch (err) {
					alert("Impossible d'ouvrir la conversation privée");
					return;
				}
			}
			if(!page.currentRoomId)
				return;
			// Envoi du message
			page.chat.send({ source: page.chat.username, target: page.currentRoomId, content: input.value });
			input.value = "";
			return false;
		});

		return page;
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.html);
		if (this.chat.ws) return;

		await this.chat.connect("/api/chat/connect");

		setInterval(() => {
			if (!this.currentRoomId) return;

			const chatList = this.html.querySelector<HTMLUListElement>("#chat")!;
			const roomMessages = this.chat.messages.filter((m) => m.target === this.currentRoomId);
			if (roomMessages.length === this.lastMessage) return;

			for (const msg of roomMessages.slice(this.lastMessage)) {
				const li = document.createElement("li");
				li.innerText = `[${msg.source}] ${msg.content}`;
				chatList.appendChild(li);
			}

			this.lastMessage = roomMessages.length;
		}, 100);
	}

	unload(): void {
		this.html.remove();
		this.chat.disconnect();
		const chat = this.html.querySelector("#chat");
		if (chat)
			chat.innerHTML = "";
	}
}
