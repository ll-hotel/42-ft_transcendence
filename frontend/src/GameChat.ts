import AppPage from "./pages/AppPage";

export class GameChat implements AppPage {
	body: HTMLElement;
	content: HTMLDivElement;
	input: HTMLInputElement;

	ws: WebSocket | null = null;
	connecting: boolean = false;

	constructor() {
		this.body = document.createElement("div");
		this.body.id = "game-chat";

		this.content = document.createElement("div");
		this.content.style = "height: 100%;";
		this.body.appendChild(this.content);

		this.input = document.createElement("input");
		this.input.type = "text";
		this.input.onkeydown = ((event) => this.onKeyDown(event));
		this.body.appendChild(this.input);
	}
	loadInto(container: HTMLElement): void {
		container.appendChild(this.body);
	}
	unload(): void {
		this.body.remove();
	}
	onKeyDown(event: KeyboardEvent) {
		const message = this.input.value;
		if (event.key == "Enter") {
			event.preventDefault();
			if (message.length == 0) return;
			if (message.length > 100) {
				alert("Message too long");
			} else {
				this.send(message);
				this.input.value = "";
			}
		}
	}
	send(message: string) {
		if (this.ws == null) {
			alert("Connecting to game room, please wait...");
			this.connect();
		}
		if (this.ws)
			this.ws.send(message);
	}
	connect() {
		if (this.ws != null || this.connecting) {
			console.log("GameChat: connecting...");
			return;
		}
		this.connecting = true;
		this.ws = new WebSocket("/api/chat");
		this.ws.onopen = () => {
			this.connecting = false;
			const pingRoutine = () => {
				if (!this.ws) return;
				this.ws.send("/ping");
				setTimeout(pingRoutine, 10000);
			};
			pingRoutine();
		};
		this.ws.onmessage = (msg) => { this.onMessage(msg); };
		this.ws.onclose = () => { this.ws = null; };
	}
	onMessage(msg: MessageEvent) {
		if (msg.data == "/pong") return;
		const p = document.createElement("p");
		p.innerHTML = new String(msg.data).toString();
		this.content.appendChild(p);
	}
};
