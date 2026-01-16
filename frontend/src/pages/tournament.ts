import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export class Tournament implements AppPage {
	html: HTMLElement;
	constructor(html: HTMLElement) {
		this.html = html;
	}
	static new(html: HTMLElement) {
		return new Tournament(html);
	}
	async loadInto(container: HTMLElement) {
		container.appendChild(this.html);
		const params = new URLSearchParams(location.search);
		const tournamentName = params.get("name");
		if (!tournamentName) {
			return gotoPage("tournaments");
		}
		const result = await this.retrieveTournamentInfo(tournamentName);
		if (!result) {
			alert("No such tournament");
			return gotoPage("tournaments");
		}
		this.displayTournament(result.info, result.avatars);
	}
	unload(): void {
		this.html.remove();
	}
	async retrieveTournamentInfo(name: string) {
		let res = await api.get("/api/tournament?name=" + name);
		if (!res || res.status == Status.not_found) {
			return null;
		}
		const info = res.payload as TournamentInfo;
		const avatars = new Map<string, string | undefined>();
		for (const playerName of info.players) {
			res = await api.get("/api/user?displayName=" + playerName);
			if (res && res.status == Status.success) {
				// const user = res.payload.user as { avatar?: string };
				// avatars.set(playerName, user.avatar);
				avatars.set(playerName, "default_pp.png");
			}
		}
		return { info, avatars };
	}
	displayTournament(info: TournamentInfo, avatars: Map<string, string | undefined>) {
		if (info.rounds.length > 0) {
			this.displayRounds(info, avatars);
		} else {
			this.displayWaitingList(info, avatars);
		}
	}
	displayWaitingList(info: TournamentInfo, avatars: Map<string, string | undefined>) {
		this.html.querySelector("#round-0")?.setAttribute("hidden", "");
		this.html.querySelector("#round-1")?.setAttribute("hidden", "");
		this.html.querySelector("#round-2")?.setAttribute("hidden", "");
		const waitingList = this.html.querySelector("#waiting-players")!;
		waitingList.removeAttribute("hidden");
		waitingList.innerHTML = "";
		for (const playerName of info.players) {
			const playerCard = createElement(
				`<div class="tournament-player-card bg-[#04809f] text-white">
					<img src="/${avatars.get(playerName)}" class="tournament-player-pic" />
					<p class="tournament-player-username">${playerName}</p>
				</div>`,
			);
			waitingList.appendChild(playerCard!);
		}
	}
	displayRounds(info: TournamentInfo, avatars: Map<string, string | undefined>) {
		this.html.querySelector("#waiting-players")!.setAttribute("hidden", "");
		const round0 = this.html.querySelector("#round-0") as HTMLElement | null;
		const round1 = this.html.querySelector("#round-1") as HTMLElement | null;
		const round2 = this.html.querySelector("#round-2") as HTMLElement | null;
		if (!round0 || !round1 || !round2) return;
		round0.removeAttribute("hidden");
		round1.removeAttribute("hidden");
		round2.removeAttribute("hidden");
		round0.innerHTML = "";
		round1.innerHTML = "";
		round2.innerHTML = "";

		const htmlItems: HTMLElement[] = [];
		if (info.rounds.length > 2) {
			round0.removeAttribute("hidden");
			htmlItems.push(round0);
		} else {
			round0.setAttribute("hidden", "");
		}
		htmlItems.push(round1);
		htmlItems.push(round2);
		for (let roundI = 0; roundI < info.rounds.length; roundI += 1) {
			const round = info.rounds[roundI];
			const roundElement = htmlItems[roundI];
			for (const match of round) {
				const matchDiv = createElement(`
					<div class="tournament-match">
						<div class="tournament-player-card">
							<img src="${avatars.get(match.p1.name)}" class="tournament-player-pic" />
							<p class="tournament-player-username">${match.p1.name}</p>
							<p class="tournament-player-score">${match.p1.score}</p>
						</div>,
						<div class="tournament-player-card">
							<img src="${avatars.get(match.p2.name)}" class="tournament-player-pic" />
							<p class="tournament-player-username">${match.p2.name}</p>
							<p class="tournament-player-score">${match.p2.score}</p>
						</div>,
					</div>
					`);
				roundElement.appendChild(matchDiv!);
			}
		}
	}
}

type TournamentInfo = {
	name: string,
	players: string[],
	rounds: TournamentMatch[][],
};
type TournamentMatch = {
	matchId: number,
	status: string,
	winner: number | null,
	p1: { name: string, score: number },
	p2: { name: string, score: number },
};

function createElement(htmlString: string): HTMLElement | null {
	const wrapper = document.createElement("div");
	wrapper.innerHTML = htmlString;
	return wrapper.firstElementChild as HTMLElement | null;
}
