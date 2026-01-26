import { api, Status } from "../api.js";
import socket, { Message } from "../socket.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js"
import {gotoPage} from "../PageLoader.js";

export class MatchMaking implements AppPage {
	html: HTMLElement;
	inQueue: boolean = false;
	constructor(html: HTMLElement) {
		this.html = html;
		// const queueButton = html.querySelector("#join-queue") as HTMLButtonElement | null;
		// queueButton?.addEventListener("click", async () => {
		// 	const join = await api.post("/api/matchmaking/join");
		// 	if (!join || join.status != Status.success) {
		// 		notify(join ? join.payload.message : "Can not join queue.", "error");
		// 	} else {
		// 		this.inQueue = true;
		// 		notify(join.payload.message, "success");
		// 	}
		// });
		const queueButton = html.querySelector<HTMLButtonElement>("#leave-queue");
		queueButton?.addEventListener("click", async () => {
			const leave = await api.post("/api/matchmaking/leave");
			if (leave)
			{
				if (leave.status != Status.success) {
					notify(leave ? leave.payload.message : "Can not leave queue.", "error");
				} else {
					notify(leave.payload.message, "success");
				}
				this.inQueue = false;
			}
			if (history.length > 1)
				history.back();
			else
				gotoPage("home");
		});
	}
	
	static async	 new(html: HTMLElement) {
		return new MatchMaking(html);
	}
    loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
		api.post("/api/matchmaking/join").then((res) => {
			if (!res || !res.payload)
				return
			notify("Queue joined !", "success");
		}).catch((err) => {
			notify(err, "error");
		})
		socket.addListener("matchmaking:found", (msg) =>
		{
			// this.onQueueNotification(msg);
			const message = msg as any as { type: string }
			if (message.type != "found") return;
			const { match, opponent } = msg as any as { match: number, opponent: string };
			notify("Match found: " + `opponent: ${opponent}`, "success");
			gotoPage("pong", `?matchId=${match}`);
		});
    }

    unload(): void {
    	this.html.remove();
    	socket.removeListener("matchmaking:found");
    	if (this.inQueue) {
    		this.inQueue = false;
    		api.delete("/api/matchmaking/leave");
    	}
    }

    onQueueNotification(m: Message) {
    	const message = m as any as { type: string }
    	if (message.type != "found") return;
    	const { match, opponent } = m as any as { match: number, opponent: string };
    	notify("Match found!\n" + `Match id: ${match}\nOpponent: ${opponent}`, "success");
    }
};
