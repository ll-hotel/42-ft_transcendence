import { api, Status } from "../../api.js";
import { gotoPage } from "../../PageLoader.js";
import socket from "../../socket.js";
import AppPage from "./../AppPage.js";

export default class Play implements AppPage {
	html: HTMLElement;
	inQueue: boolean = false;
	constructor(html: HTMLElement) {
		this.html = html;
		const playLocal = html.querySelector("#play-local")! as HTMLButtonElement;
		playLocal?.addEventListener("click", () => this.playLocal());
		const playRandom = html.querySelector("#play-random")! as HTMLButtonElement;
		playRandom?.addEventListener("click", () => this.playRandom());
		const playFriend = html.querySelector("#play-friend")! as HTMLButtonElement;
		playFriend?.addEventListener("click", () => this.playFriend());
		const joinTournament = html.querySelector("#join-tournament")! as HTMLButtonElement;
		joinTournament?.addEventListener("click", () => this.joinTournament());
		const createTournament = html.querySelector("#create-tournament")! as HTMLButtonElement;
		createTournament?.addEventListener("click", () => this.createTournament());
	}
	static new(html: HTMLElement): AppPage | null {
		return new Play(html);
	}
	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
	}
	unload(): void {
		this.html.remove();
	}
	async playLocal() {
		return gotoPage("play/local");
	}
	async playRandom() {
		socket.addListener("matchmaking", (message) => {
			if (message.topic != "ready") return;
			socket.removeListener("matchmaking");
			this.inQueue = false;

			const matchMsg = message as { match: number, opponent: string };
			alert("Match found! Playing against " + matchMsg.opponent);
			gotoPage("play/match", `?id=${matchMsg.match}`);
		})
		const join = await api.post("/api/matchmaking/join");
		if (!join || join.status != Status.success) {
			alert(join ? join.payload.message : "Can not join queue.");
		} else {
			this.inQueue = true;
			alert(join.payload.message);
		}
	}
	playFriend() { }
	joinTournament() { }
	createTournament() { }

	
};