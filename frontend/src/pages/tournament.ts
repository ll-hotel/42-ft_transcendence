import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import socket from "../socket.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js";

type TournamentMessage = {
	type: string,
};
export class Tournament implements AppPage {
	html: HTMLElement;
	leaveButton: HTMLButtonElement;
	constructor(html: HTMLElement) {
		this.html = html;
		this.leaveButton = html.querySelector<HTMLButtonElement>("#tournament-leave")!;
	}
	static new(html: HTMLElement) {
		const leaveButton = html.querySelector<HTMLButtonElement>("#tournament-leave");
		if (leaveButton == null) {
			notify("Missing button", "error");
			return null;
		}
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
			notify("No such tournament", "error");
			return gotoPage("tournaments");
		}
		socket.addListener("tournament", (data) => {
			const message = data as unknown as TournamentMessage;
			if (message.type != "left" && message.type != "join") return;
			const { name } = message as unknown as { name: string };
			if (message.type == "left") {
				this.removeWaitingPlayer(name);
			} else {
				this.addWaitingPlayer(name);
			}
		});
		this.displayTournament(result.info);
		this.toggleStartButton(result.info);
		this.leaveButton.onclick = () => this.leaveTournament(tournamentName);
	}
	unload(): void {
		this.html.remove();
		socket.removeListener("tournament");
	}
	async retrieveTournamentInfo(name: string) {
		let res = await api.get("/api/tournament?name=" + name);
		if (!res || res.status == Status.not_found) {
			if (res && res.payload.message) notify(res.payload.message, "error");
			return null;
		}
		const info = res.payload as TournamentInfo;
		return { info };
	}

	displayTournament(info: TournamentInfo) {
		const nameElement = this.html.querySelector("#tournament-name") as HTMLElement | null;
		if (nameElement) nameElement.innerText = "Tournament [" + info.name + "]";
		if (info.rounds.length > 0) {
			this.displayRounds(info);
		} else {
			this.displayWaitingList(info);
		}
	}
	async toggleStartButton(info: TournamentInfo) {
		const res = await api.get("/api/me");
		if (!res || res.status != Status.success) {
			if (res && res.payload.message) notify(res.payload.message, "error");
			return;
		}
		const startButton = this.html.querySelector<HTMLButtonElement>("#tournament-start");
		if (startButton) {
			startButton.setAttribute("hidden", "");
			startButton.onclick = null;
			if (info.creator.name == res.payload.displayName && info.status == "pending") {
				startButton.removeAttribute("hidden");
				startButton.onclick = () => this.startTournament(info.name);
			}
		}
	}
	async startTournament(name: string) {
		const res = await api.post("/api/tournament/start", { name });
		if (!res) return;
		if (res.status != Status.success) {
			notify("Can not start tournament: " + res.payload.message, "error");
			return;
		}
		notify("Tournament started", "success");
		const tournament = await this.retrieveTournamentInfo(name);
		if (!tournament) return;
		return this.displayRounds(tournament.info);
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
		const round0 = this.html.querySelector<HTMLElement>("#round-0");
		const round1 = this.html.querySelector<HTMLElement>("#round-1");
		const round2 = this.html.querySelector<HTMLElement>("#round-2");
		if (!round0 || !round1 || !round2) {
			return notify("Missing HTML elements", "error");
		}
		round0.innerHTML = "";
		round1.innerHTML = "";
		round2.innerHTML = "";

		const htmlItems: HTMLElement[] = [round0, round1, round2];
		for (let roundI = 0; roundI < info.rounds.length; roundI += 1) {
			const round = info.rounds[roundI];
			const roundElement = htmlItems[roundI];
			for (const match of round) {
				this.addMatch(match, roundElement);
			}
		}
		if (round0.children.length > 0) {
			round0.removeAttribute("hidden");
		}
		if (round1.children.length > 0) {
			round1.removeAttribute("hidden");
		}
		if (round2.children.length > 0) {
			round2.removeAttribute("hidden");
		}
	}
	async addMatch(match: TournamentMatch, round: HTMLElement) {
		const avatar1: string = await getUserAvatar(match.p1.name);
		const avatar2: string = await getUserAvatar(match.p2.name);
		const matchDiv = createElement(`
			<div class="tournament-match">
				<div name="@${match.p1.name}" class="tournament-player-card">
					<img src="${avatar1}" class="tournament-player-pic" />
					<p class="tournament-player-username">${match.p1.name}</p>
					<p class="tournament-player-score">${match.p1.score}</p>
				</div>
				<div name="@${match.p2.name}" class="tournament-player-card">
					<img src="${avatar2}" class="tournament-player-pic" />
					<p class="tournament-player-username">${match.p2.name}</p>
					<p class="tournament-player-score">${match.p2.score}</p>
				</div>
			</div>
			`);
		const playerCard1 = matchDiv!.querySelector(`[name="@${match.p1.name}"]`)!;
		const playerCard2 = matchDiv!.querySelector(`[name="@${match.p2.name}"]`)!;
		if (match.winner === null) {
			playerCard1.classList.add("bg-neutral-500", "text-white", "font-bold");
			playerCard2.classList.add("bg-neutral-500", "text-white", "font-bold");
		} else if (match.winner == 1) {
			playerCard1.classList.add("bg-green-200");
			playerCard2.classList.add("bg-red-200");
		} else {
			playerCard1.classList.add("bg-red-200");
			playerCard2.classList.add("bg-green-200");
		}
		round.appendChild(matchDiv!);
	}
	removeWaitingPlayer(name: string) {
		const playerCard = this.html.querySelector(`#waiting-players [name="@${name}"]`);
		if (!playerCard) return;
		playerCard.remove();
	}
	async addWaitingPlayer(name: string) {
		const playerList = this.html.querySelector(`#waiting-players`);
		if (!playerList) return;
		const avatar: string = await getUserAvatar(name);
		const playerCard = createElement(
			`<div name="@${name}" class="tournament-player-card bg-neutral-500 text-white font-bold">
				<img src="${avatar}" class="tournament-player-pic" />
				<p class="tournament-player-username">${name}</p>
			</div>`,
		)!;
		playerList.appendChild(playerCard);
	}
	leaveTournament(name: string) {
		api.post("/api/tournament/leave", { name }).then((res) => {
			if (!res) return;
			if (res.status != Status.success) {
				return notify(res.payload.message, "error");
			}
			notify(res.payload.message, "success");
			gotoPage("tournaments");
		});
	}
}

async function getUserAvatar(username: string) {
	let avatar: string = "default_pp.png";
	const res = await api.get("/api/user?displayName=" + username);
	if (res && res.status == Status.success) {
		const { user } = res.payload as { user: { avatar: string } };
		if (user.avatar == "DEFAULT_AVATAR") user.avatar = "default_pp.png";
		else avatar = user.avatar;
	}
	return avatar;
}

type TournamentInfo = {
	creator: { name: string },
	name: string,
	status: string,
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
