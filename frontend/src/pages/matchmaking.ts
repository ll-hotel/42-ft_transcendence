import { api, Status } from "../api.js";
import socket, { Message } from "../socket.js";
import { notify } from "./utils/notifs.js";
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
				notify(join ? join.payload.message : "Can not join queue.", "error");
			} else {
				this.inQueue = true;
				notify(join.payload.message, "success");
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
    	const message = m as any as { type: string }
    	if (message.type != "found") return;
    	const { match, opponent } = m as any as { match: number, opponent: string };
    	
    	notify("Match found!\n" + `Match id: ${match}\nOpponent: ${opponent}`, "success");
    }
};
