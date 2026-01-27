import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js"
import { MatchInfo } from "./profile/matches.js";
import { notify } from "../utils/notifs.js";

export class ProfilePage implements AppPage {
	content: HTMLElement;
	displayname: HTMLElement;
	username: HTMLElement;

	private constructor(content: HTMLElement) {
		this.content = content;
		this.displayname = content.querySelector("#profile-displayname")!;
		this.username = content.querySelector("#profile-username")!;
		const logout = content.querySelector("#logout") as HTMLElement;
		const edit = content.querySelector("#edit") as HTMLElement;
		logout.onclick = () => this.logoutClick();
		edit.onclick = () => this.editClick();
	}
	static async new(content: HTMLElement): Promise<AppPage | null> {
		const logout = content.querySelector("#logout");
		const edit = content.querySelector("#edit");
		const displayname = content.querySelector("#profile-displayname");
		const username = content.querySelector("#profile-username");
		if (!content || !logout || !displayname || !edit || !username) {
			return null;
		}
		return new ProfilePage(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.content);
		return this.loadUserInfo();
	}

	unload(): void {
		this.content.remove();
	}

	async loadUserInfo() {
		const res = await api.get("/api/me");
		if (!res || res.status != Status.success) {
			return gotoPage("login");
		}
		const userInfo = res.payload as { displayName: string, username:string, id:number, avatar: string };
		const contMatchList = this.content.querySelector("#match-list");
		const avatarImg = this.content.querySelector<HTMLImageElement>("#profile-picture");
		if (avatarImg)
			avatarImg.src = userInfo.avatar == "DEFAULT_AVATAR" ? "default_pp.png" : userInfo.avatar;
		this.displayname.innerHTML = userInfo.displayName;
		this.username.innerHTML = userInfo.username;
		
		const resMatch = await api.get("/api/me/history");
		if (!resMatch || resMatch.status != Status.success) {
			notify("Can't load matchs info", "error");
			return;
		}
		const MatchList = resMatch.payload;
		if (contMatchList && contMatchList.children.length == 0) {
		// L'user est toujours le player1 (voir api)
			for (let i = 0; i < MatchList.length ; i++) {
				let matchInfo = MatchList[i];
				let date = new Date(matchInfo.match.endedAt);
				contMatchList.append(MatchInfo.new(
					date.toLocaleDateString("fr-FR"),
					date.toLocaleTimeString("fr-FR"),
					{ name: this.displayname.innerHTML, score: matchInfo.match.scoreP1 },
					{ name: matchInfo.opponent.displayName, score: matchInfo.match.scoreP2 },
					userInfo.displayName || "Display name"
				).toHTML());
			}
			if (!MatchList.length)
				contMatchList.append(MatchInfo.noMatchHtml());
		}

		const infoPlayedMatch = this.content.querySelector("#played-match");
		const infoVictoryRate = this.content.querySelector("#victory-rate");
		const infoPointsScored = this.content.querySelector("#points-scored");
		const infoPointsTanked = this.content.querySelector("#points-tanked");
		const infoTourPlayed = this.content.querySelector("#tournaments-played");
		const infoTourPlacement = this.content.querySelector("#tournament-best");

		if (!infoPlayedMatch || !infoVictoryRate || !infoPointsScored || !infoPointsTanked || !infoTourPlayed || !infoTourPlacement)
			return notify("Missing info in Profile.html", "error");

		const resStat = await api.get("/api/me/stats");

		if (!resStat || resStat.status != Status.success)
			return notify("Can't load my stats", "error");

		const Stat = resStat.payload;

		infoPlayedMatch.textContent = Stat.matchPlayed;
		infoVictoryRate.textContent = Stat.victoryRate + "%";
		infoPointsScored.textContent = Stat.pointScored;
		infoPointsTanked.textContent = Stat.pointConceded;
		infoTourPlayed.textContent = Stat.nbTournament + " / " + Stat.nbTournamentVictory;
		infoTourPlacement.textContent = Stat.Placement;
	}

	async logoutClick() {
		const reply = await api.post("/api/auth/logout");
		if (!reply || reply.status == Status.unauthorized) {
			// Unauthorized = not logged in or wrong user.
		}
		notify("Logged out", "info");
		await gotoPage("login");
	}

	async editClick() {
		await gotoPage("profile/edit");
	}
};
