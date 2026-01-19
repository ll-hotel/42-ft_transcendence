import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";
import { MatchInfo } from "./profile/matches.js";

export class ProfilePage implements AppPage {
	html: HTMLElement;
	displayname: HTMLElement;
	username: HTMLElement;

	private constructor(content: HTMLElement) {
		this.html = content;
		this.displayname = content.querySelector("#profile-displayname")!;
		this.username = content.querySelector("#profile-username")!;
		const logout = content.querySelector("#logout") as HTMLElement;
		const edit = content.querySelector("#edit") as HTMLElement;
		logout.onclick = () => this.logoutClick();
		edit.onclick = () => this.editClick();
	}
	static new(content: HTMLElement) {
		const logout = content.querySelector("#logout");
		const edit = content.querySelector("#edit");
		const displayname = content.querySelector("#profile-displayname");
		// const username = content.querySelector("#profile-username")!;
		// if (!content || !logout || !displayname || !username) {
		if (!content || !logout || !displayname || !edit) {
			return null;
		}
		return new ProfilePage(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.html);
		return this.loadUserInfo();
	}

	unload(): void {
		this.html.remove();
	}

	async loadUserInfo() {
		const res = await api.get("/api/me");
		if (!res || res.status != Status.success) {
			return gotoPage("login");
		}
		const userInfo = res.payload as { displayName?: string, id?: number, avatar?: string };
		this.displayname.innerHTML = userInfo.displayName || "Display name";

		const pictureElt = this.html.querySelector("#profile-picture") as HTMLElement | null;
		if (pictureElt) {
			if (userInfo.avatar == "DEFAULT_AVATAR") {
				userInfo.avatar = "default_pp.png";
			}
			pictureElt.setAttribute("src", userInfo.avatar!);
		}

		const contMatchList = this.html.querySelector("#match-list");

		const resMatch = await api.get("/api/me/history");
		if (!resMatch || resMatch.status != Status.success) {
			alert("Can't load matchs info");
			return;
		}
		const MatchList = resMatch.payload;
		if (contMatchList && contMatchList.children.length == 0) {
			// L'user est toujours le player1 (voir api)
			for (let i = 0; i < MatchList.length; i++) {
				let matchInfo = MatchList[i];
				let date = new Date(matchInfo.match.endedAt);
				contMatchList.append(
					MatchInfo.new(
						date.toLocaleDateString("fr-FR"),
						date.toLocaleTimeString("fr-FR"),
						{ name: this.displayname.innerHTML, score: matchInfo.match.scoreP1 },
						{ name: matchInfo.opponent.displayName, score: matchInfo.match.scoreP2 },
						userInfo.displayName || "Display name",
					).toHTML(),
				);
			}
			if (!MatchList.length) {
				contMatchList.append(MatchInfo.noMatchHtml());
			}
		}

		const infoPlayedMatch = this.html.querySelector("#played-match");
		const infoVictoryRate = this.html.querySelector("#victory-rate");
		const infoPointsScored = this.html.querySelector("#points-scored");
		const infoPointsTanked = this.html.querySelector("#points-tanked");
		const infoTourPlayed = this.html.querySelector("#tournaments-played");
		const infoTourPlacement = this.html.querySelector("#tournament-best");

		if (
			!infoPlayedMatch || !infoVictoryRate || !infoPointsScored || !infoPointsTanked || !infoTourPlayed ||
			!infoTourPlacement
		) {
			return alert("Missing info in Profile.html");
		}

		const resStat = await api.get("/api/me/stats");

		if (!resStat || resStat.status != Status.success) {
			return alert("Can't load my stats");
		}

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
		await gotoPage("login");
	}

	async editClick() {
		await gotoPage("profile/edit");
	}
}
