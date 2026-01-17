import { api, Status } from "../api.js";
import socket, { Message } from "../socket.js";
import AppPage from "./AppPage.js"

export class MatchMaking implements AppPage {
	html: HTMLElement;
	inQueue: boolean = false;
	constructor(html: HTMLElement) {
		this.html = html;
		const queueButton = html.querySelector("#join-queue") as HTMLButtonElement | null;
		queueButton?.addEventListener("click", async () => {
			const join = await api.post("/api/matchmaking/join");
			if (!join || join.status != Status.success) {
				alert(join ? join.payload.message : "Can not join queue.");
			} else {
				this.inQueue = true;
				alert(join.payload.message);
			}
		});
	}
	
	static new(html: HTMLElement) {
		return new MatchMaking(html);
	}
    loadInto(container: HTMLElement): void {
    	container.appendChild(this.html);
    	socket.addListener("matchmaking", (m) => this.onQueueNotification(m));
    }
    unload(): void {
    	this.html.remove();
    	socket.removeListener("matchmaking");
    	if (this.inQueue) {
    		this.inQueue = false;
    		api.post("/api/matchmaking/leave");
    	}
    }

    onQueueNotification(m: Message) {
    	if (m.topic != "found") return;
    	const { match, opponent } = m as { match: number, opponent: string };
    	
    	alert("Match found!\n" + `Match id: ${match}\nOpponent: ${opponent}`);
    }
};
