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
	private lastNonEmptyRounds: number | null = null;
	constructor(html: HTMLElement) {
		this.html = html;
		this.leaveButton = html.querySelector<HTMLButtonElement>("#tournament-leave")!;
	}
	static async new(html: HTMLElement) {
		const leaveButton = html.querySelector<HTMLButtonElement>("#tournament-leave");
		if (leaveButton == null) {
			notify("Missing button", "error");
			return null;
		}
		return new Tournament(html);
	}
	async loadInto(container: HTMLElement) {
		container.appendChild(this.html);
		this.resetUI();
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
		socket.addListener("tournament", async (data) => {
			const msg = data as unknown as { type?: string, name?: string, content?: string };
	
			if (typeof msg.content === "string") {
				if (msg.content === "update") {
					const updated = await this.retrieveTournamentInfo(tournamentName);
					if (updated) {
						const newCount = this.countNonEmptyRounds(updated.info);
						if (this.lastNonEmptyRounds !== null && newCount > this.lastNonEmptyRounds && updated.info.status !== "ended") {
							notify("New round started", "info");
						}
						this.lastNonEmptyRounds = newCount;
						if (updated.info.status === "ended") this.displayEndScreen(updated.info);
						else this.displayRounds(updated.info);
					}
					return;
				}
				if (msg.content.startsWith("ended:")) {
					const winner = msg.content.split(":")[1];
					const updated = await this.retrieveTournamentInfo(tournamentName);
					if (updated) {
						updated.info.winner = winner || updated.info.winner || null;
						this.displayEndScreen(updated.info);
					}
					return;
				}
			}

			if (msg.type === "left" || msg.type === "join") {
				const { name } = msg as { name: string };
				if (msg.type === "left") this.removeWaitingPlayer(name);
				else this.addWaitingPlayer(name);
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
		if (info.status === "ended") {
			this.displayEndScreen(info);
		} else if (info.rounds.length > 0) {
			this.displayRounds(info);
		} else {
			this.displayWaitingList(info);
		}
	}
	async toggleStartButton(info: TournamentInfo) {
		const res = await api.get("/api/user/me");
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
		this.html.querySelector("#tournament-end")?.setAttribute("hidden", "");
		const waitingList = this.html.querySelector("#waiting-players")!;
		waitingList.removeAttribute("hidden");
		waitingList.innerHTML = "";
		for (const name of info.players) {
			this.addWaitingPlayer(name);
		}
	}
	async displayRounds(info: TournamentInfo) {
		this.html.querySelector("#waiting-players")!.setAttribute("hidden", "");
		this.html.querySelector("#tournament-end")?.setAttribute("hidden", "");
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
				await this.addMatch(match, roundElement);
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
		this.lastNonEmptyRounds = this.countNonEmptyRounds(info);
	}
	async addMatch(match: TournamentMatch, round: HTMLElement) {
		if (!match?.p1 || !match?.p2)
			return;
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

	displayEndScreen(info: TournamentInfo) {
		this.displayRounds(info);
		const container = this.html.querySelector("#tournament-end") as HTMLElement | null;
		if (!container) return;
		container.removeAttribute("hidden");
		container.innerHTML = "";
		const winner = info.winner ? info.winner : "Unknown";
		
		getUserAvatar(winner).then((avatar) => {
        const winnerCard = createElement(`
            <div class="tournament-end-banner">
                <h2 class="text-2xl font-bold">Tournament Ended</h2>
                <p class="text-xl">Winner:</p>
                <div class="tournament-player-card bg-yellow-500 border border-yellow-500 text-white font-bold shadow-lg p-2 rounded-lg">
                    <img src="${avatar}" class="tournament-player-pic" />
                    <p class="tournament-player-username">${winner}</p>
                </div>
            </div>
        `)!;
        container.appendChild(winnerCard)});
	}

	private resetUI() {
		const waiting = this.html.querySelector("#waiting-players");
		const r0 = this.html.querySelector("#round-0");
		const r1 = this.html.querySelector("#round-1");
		const r2 = this.html.querySelector("#round-2");
		const end = this.html.querySelector("#tournament-end");
		if (waiting) { waiting.innerHTML = ""; waiting.setAttribute("hidden", ""); }
		if (r0) { r0.innerHTML = ""; r0.setAttribute("hidden", ""); }
		if (r1) { r1.innerHTML = ""; r1.setAttribute("hidden", ""); }
		if (r2) { r2.innerHTML = ""; r2.setAttribute("hidden", ""); }
		if (end) { end.innerHTML = ""; end.setAttribute("hidden", ""); }
		this.lastNonEmptyRounds = null;
	}

	private countNonEmptyRounds(info: TournamentInfo): number {
		return info.rounds.reduce((acc, r) => acc + (r.length > 0 ? 1 : 0), 0);
	}
	leaveTournament(name: string) {
		api.post("/api/tournament/leave", { name }).then((res) => {
			if (!res) return;
			if (res.status !== Status.success && res.status !== Status.bad_request) {
				notify(res.payload.message, "error");
			}
			else if (res.status === Status.success) {
				notify(res.payload.message, "success");
			}
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
	winner?: string | null,
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