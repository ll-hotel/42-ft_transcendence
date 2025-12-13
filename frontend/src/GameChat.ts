import AppPage from "./pages/AppPage";

export class GameChat implements AppPage {
	body: HTMLElement;
	content: HTMLDivElement;
	input: HTMLInputElement;

	ws: WebSocket | null = null;

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
			if (message.length > 200) {
				alert("Message too long");
			} else {
				this.send(message);
				this.input.value = "";
			}
		}
	}
	async send(message: string) {
		if (this.ws == null) {
			alert("Connecting to game room, please wait...");
			await this.connect();
		}
		if (this.ws)
			this.ws.send(message);
	}
	async connect(): Promise<void> {
		if (this.ws != null) {
			return;
		}
		return new Promise<void>((res) => {
			this.ws = new WebSocket("/api/chat");
			this.ws.onopen = () => { res(); };
			this.ws.onmessage = (e) => { this.onMessage(e); };
			this.ws.onclose = () => { this.ws = null; };
		});
	}
	onMessage(event: MessageEvent<string>) {
		let origin: string, text: string;
		try {
			const msg = JSON.parse(event.data);
			origin = msg.origin;
			text = msg.text;
		} catch (error) {
			alert("Invalid game chat message. See the console for details.");
			console.log(error);
			return;
		};
		if (origin.length == 0 && text == "ping") {
			this.send("pong");
			return;
		}
		const message_box = document.createElement("div");
		message_box.innerHTML = `<b>${origin}</b><br><i>${text}</i>`;
		message_box.style = "flex-direction: column; align-items: left;";
		this.content.appendChild(message_box);
	}
};
