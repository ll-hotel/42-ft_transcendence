import AppPage from "./AppPage.js"

export class ChatElement implements AppPage {
	html: HTMLElement;
	chat: Chat;
	lastMessage: number;

	private constructor(html: HTMLElement) {
		this.html = html;
		this.chat = Chat.new("/api/chat/connect");
		this.lastMessage = 0;
	}
	static new(html: HTMLElement): ChatElement | null {
		const form: HTMLFormElement | null = html.querySelector("form#chat-input");
		if (!form || !form.querySelector("input[name=input]")) {
			return null;
		}
		const page = new ChatElement(html);
		form.addEventListener("submit", (event: SubmitEvent) => {
			event.preventDefault();
			const input: HTMLInputElement | null = form.querySelector("input[name=input]");
			if (input && input.value) {
				page.chat.send({
					source: page.chat.username,
					target: "@" + page.chat.username,
					content: input.value,
				});
				input.value = "";
			}
			return false;
		});
		return page;
	}
    async loadInto(container: HTMLElement) {
    	container.appendChild(this.html);
    	if (this.chat.ws) {
    		return;
    	}
		const socket = await this.chat.connect();
		socket.addEventListener("message", () => {
			if (this.chat.messages.length == this.lastMessage) {
				return;
			}
			if (this.chat.messages.length < this.lastMessage) {
				this.lastMessage = 0;
			}
			for (const message of this.chat.messages.slice(this.lastMessage)) {
				const elt = document.createElement("li");
				elt.innerText = `[${message.source}] ${message.content}`;
				this.html.querySelector("#chat")?.appendChild(elt);
			}
			this.lastMessage = this.chat.messages.length;
		});
    }
    unload(): void {
    	this.html.remove();
    	this.chat.disconnect();
    	const chat = this.html.querySelector("#chat-output");
    	if (chat) {
    		chat.innerHTML = "";
    	}
    }
};

export type Message = {
	source: string,
	target: string,
	content: string,
};

class Chat {
	url: string;
	ws: WebSocket | null;
	messages: Message[];
	username: string;

	private constructor(url: string) {
		this.url = url;
		this.ws = null;
		this.messages = [];
		this.username = "";
	}
	static new(url: string) {
		return new Chat(encodeURI(url));
	}

	async send(message: Message) {
		(this.ws == null ? await this.connect() : this.ws).send(JSON.stringify(message));
	}
	async connect(): Promise<WebSocket> {
		if (this.ws != null) {
			return this.ws;
		}
		return new Promise((res) => {
			this.ws = new WebSocket(this.url);
			this.ws.addEventListener("open", () => { if (this.ws) res(this.ws); });
			this.ws.addEventListener("close", () => { this.ws = null; });
			this.ws.addEventListener("message", (event) => this.message(event));
		});
	}
	disconnect() {
		this.ws?.close();
		this.username = "";
	}
	private message(event: MessageEvent<string>) {
		let msg: Message;
		try {
			msg = JSON.parse(event.data);
		} catch (error) {
			alert("Invalid game chat message. See the console for details.");
			console.log(error);
			return;
		};
		if (!this.username && this.messages.length == 0) {
			this.username = msg.source;
		}
		if (msg.source && msg.target) {
			this.messages.push(msg);
		}
	}
};
