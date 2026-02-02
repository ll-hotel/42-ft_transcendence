import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import socket from "../socket.js";
import AppPage from "./AppPage.js";
import { notify } from "../utils/notifs.js";

export default class Play implements AppPage {
	html: HTMLElement;
	inQueue: boolean = false;
	constructor(html: HTMLElement) {
		this.html = html;
		const playLocal = html.querySelector("#play-local")! as HTMLButtonElement;
		playLocal?.addEventListener("click", () => this.playLocal());
		const playRandom = html.querySelector("#play-random")! as HTMLButtonElement;
		playRandom?.addEventListener("click", () => this.playRandom());
		const playTournament = html.querySelector("#play-tournament")! as HTMLButtonElement;
		playTournament?.addEventListener("click", () => this.playTournament());
	}
	static async new(html: HTMLElement): Promise<AppPage> {
		return new Play(html);
	}
	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
	}
	unload(): void {
		this.html.remove();
	}
	async playLocal() {
		api.get("/api/game/current").then((res) => {
		if (!res) return;
		if (res.status == Status.not_found)
			gotoPage("play/local");
		else
			notify("You are already on a match", "info");
		});
	}
	async playRandom() {
		api.get("/api/game/current").then((res) => {
			if (!res)
				return;
			if (res.status == Status.not_found)
			{
				gotoPage("matchmaking");
			}
			else if (res.status == Status.success)
				gotoPage("play/match", "?id=" + res.payload.id);
			else
				notify("Error " + res.status, "error");
		});
	}

	playTournament() {
		gotoPage("tournaments");
	}
};