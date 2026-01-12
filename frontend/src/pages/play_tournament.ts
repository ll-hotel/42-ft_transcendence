import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export default class PlayTournament implements AppPage {
	html: HTMLElement;
	constructor(html: HTMLElement) {
		this.html = html;
	}
	static new(html: HTMLElement): AppPage | null {
		return new PlayTournament(html);
	}
	async loadInto(container: HTMLElement) {
		const params = new URLSearchParams(location.search);
		const tournamentName = params.get("name");
		if (!tournamentName) {
			if (history.length > 2) history.back();
			else gotoPage("play");
			return;
		}
		container.appendChild(this.html);
		const me = await api.get("/api/me");
		if (me && me.payload.tournamentName == tournamentName) {
			this.displayStatus(tournamentName, me.payload.tournamentId);
			return;
		}
		const join = await api.post("/api/tournament/join", { name: tournamentName });
		if (!join) {
			return this.displayError("Request failed");
		}
		if (join.status == Status.success) {
			return this.displayStatus(tournamentName, join.payload.tournamendId);
		}
		this.displayError(JSON.stringify(join.payload.message));
	}
	unload(): void {
		this.html.remove();
	}
	async displayStatus(name: string, id: number) {
		const display = this.html.querySelector("#tournament-display");
		if (!display) return;
		display.removeAttribute("hidden");
		this.html.querySelector("#error")?.setAttribute("hidden", "");

		const status = await api.get("/api/tournament/" + id);
		if (!status) return this.displayError("Can not get tournament informations.");
		type Tournament = {
			id: number,
			createdBy: string,
			size: 4,
			name: string,
			status: string,
			winner: string,
			createdAt: Date,
		};
		type Payload = {
			tournament: Tournament,
			players: string[],
			rounds: any[][],
		};
		const { tournament, players, rounds }: Payload = status.payload;

		const tournamentName = display.querySelector("#tournament-name")! as HTMLElement;
		const tournamentStatus = display.querySelector("#tournament-status")! as HTMLElement;
		const tournamentPlayers = display.querySelector("#tournament-players")! as HTMLElement;

		tournamentName.innerText = tournament.name;
		tournamentStatus.innerText = tournament.status;
		for (const player of players) {
			const li = document.createElement("li");
			li.className = "";
			li.innerText = player;
			tournamentPlayers.appendChild(li);
		}
	}
	displayError(innerHTML: string) {
		this.html.querySelector("#tournament-display")?.setAttribute("hidden", "");
		const errorElement = this.html.querySelector("#error");
		if (errorElement) {
			errorElement.removeAttribute("hidden");
			errorElement.innerHTML = innerHTML;
		}
	}
}
