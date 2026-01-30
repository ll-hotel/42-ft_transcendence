import { api, Status } from "../api.js";
import socket, { Message } from "../socket.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js"
import {gotoPage} from "../PageLoader.js";

export class MatchMaking implements AppPage {
	html: HTMLElement;
	queueButton: HTMLButtonElement;
	inQueue: boolean = false;

	constructor(html: HTMLElement, queueButton: HTMLButtonElement) {
		this.html = html;
		this.queueButton = queueButton;
	}
	
	static async new(html: HTMLElement): Promise<AppPage | null>{
		const queueButton = html.querySelector<HTMLButtonElement>("#leave-queue");
		if (!queueButton) {
			notify("Missing HTML elements in matchmaking.html", "error");
			return null;
		}
		return new MatchMaking(html, queueButton);
	}
	loadInto(container: HTMLElement): void {
		this.queueButton.hidden = false;
		container.appendChild(this.html);
		socket.addListener("matchmaking:found", (message) => {
			socket.removeListener("matchmaking:found");
			this.inQueue = false;
			this.queueButton.hidden = true;
			const matchMsg = message as { match: number, opponent: string };
			notify("Match found! Playing against " + matchMsg.opponent, "success");
			setTimeout( () => {
				gotoPage("play/match", `?id=${matchMsg.match}`);
			}, 3000);
		})
		api.post("/api/queue/join").then( (join) =>
		{
			if (!join || join.status != Status.success) {
				notify(join ? join.payload.message : "Can not join queue.", "error");
				if (join?.payload.message !== "Already in queue")
					return gotoPage("home");
			} else {
				this.inQueue = true;
				notify(join.payload.message, "success");
			}
		});

		this.queueButton!.addEventListener("click", async () => {
			const leave = await api.post("/api/queue/leave");
			if (!leave)
				return;
			if (leave.status != Status.success)
				notify("Error : " + leave.payload.message, "error");
			notify("Left queue", "info");
			gotoPage("home");
		});
	}

	unload(): void {
		this.html.remove();
	}

    onQueueNotification(m: Message) {
    	const message = m as any as { type: string }
    	if (message.type != "found") return;
    	const { match, opponent } = m as any as { match: number, opponent: string };
    	notify("Match found!\n" + `Match id: ${match}\nOpponent: ${opponent}`, "success");
    }
};
