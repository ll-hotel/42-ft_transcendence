import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import socket from "../socket.js";
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
		socket.addListener("tournament", (message) => {
			if (message.type != "left" && message.type != "join") return;
			const { name } = message as unknown as { name: string };
			if (message.type == "left") {
				this.removeWaitingPlayer(name);
			} else {
				this.addWaitingPlayer(name);
			}
		});
		this.displayTournament(result.info);
	}
	unload(): void {
		this.html.remove();
		socket.removeListener("tournament");
	}
	async retrieveTournamentInfo(name: string) {
		let res = await api.get("/api/tournament?name=" + name);
		if (!res || res.status == Status.not_found) {
			return null;
		}
		const info = res.payload as TournamentInfo;
		return { info };
	}
	displayTournament(info: TournamentInfo) {
		if (info.rounds.length > 0) {
			this.displayRounds(info);
		} else {
			this.displayWaitingList(info);
		}
	}
	displayWaitingList(info: TournamentInfo) {
		this.html.querySelector("#round-0")?.setAttribute("hidden", "");
		this.html.querySelector("#round-1")?.setAttribute("hidden", "");
		this.html.querySelector("#round-2")?.setAttribute("hidden", "");
		const waitingList = this.html.querySelector("#waiting-players")!;
		waitingList.removeAttribute("hidden");
		waitingList.innerHTML = "";
		for (const name of info.players) {
			this.addWaitingPlayer(name);
		}
	}
	async displayRounds(info: TournamentInfo) {
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
				let avatar1 = "default_pp.png";
				const res1 = await api.get("/api/user?displayName=" + match.p1.name);
				if (res1 && res1.status == Status.success) {
					avatar1 = res1.payload.avatar;
				}
				let avatar2 = "default_pp.png";
				const res2 = await api.get("/api/user?displayName=" + match.p2.name);
				if (res2 && res2.status == Status.success) {
					avatar2 = res2.payload.avatar;
				}
				const matchDiv = createElement(`
					<div class="tournament-match">
						<div name="@${match.p1.name}" class="tournament-player-card">
							<img src="${avatar1}" class="tournament-player-pic" />
							<p class="tournament-player-username">${match.p1.name}</p>
							<p class="tournament-player-score">${match.p1.score}</p>
						</div>,
						<div name="@${match.p2.name}" class="tournament-player-card">
							<img src="${avatar2}" class="tournament-player-pic" />
							<p class="tournament-player-username">${match.p2.name}</p>
							<p class="tournament-player-score">${match.p2.score}</p>
						</div>,
					</div>
					`);
				roundElement.appendChild(matchDiv!);
			}
		}
	}
	removeWaitingPlayer(name: string) {
		const playerCard = this.html.querySelector(`#waiting-players [name="@${name}"]`);
		if (!playerCard) return;
		playerCard.remove();
	}
	async addWaitingPlayer(name: string) {
		const playerList = this.html.querySelector(`#waiting-players`);
		if (!playerList) return;
		let avatar: string = "default_pp.png";
		const res = await api.get("/api/user?displayName=" + name);
		if (res && res.status == Status.success) {
			const { user } = res.payload as { user: { avatar: string } };
			if (user.avatar == "DEFAULT_AVATAR") user.avatar = "default_pp.png";
			else avatar = user.avatar;
		}
		const playerCard = createElement(
			`<div name="@${name}" class="tournament-player-card bg-[#04809f] text-white">
				<img src="${avatar}" class="tournament-player-pic" />
				<p class="tournament-player-username">${name}</p>
			</div>`,
		)!;
		playerList.appendChild(playerCard);
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
