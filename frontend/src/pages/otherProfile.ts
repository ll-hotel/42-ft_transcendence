import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import { FriendButton } from "../friendButton.js";
import AppPage from "./AppPage.js"
import { MatchInfo } from "./profile/matches.js";
import { notify } from "../utils/notifs.js";

export class OtherProfilePage implements AppPage {
	content: HTMLElement;
	displayname: HTMLElement;
	username: HTMLElement;

	private constructor(content: HTMLElement) {
		this.content = content;
		this.displayname = content.querySelector("#profile-displayname")!;
		this.username = content.querySelector("#profile-username")!;
	}
	static async new(content: HTMLElement) {
		const displayname = content.querySelector("#profile-displayname");
		 const username = content.querySelector("#profile-username")!;
		if (!content || !displayname || !username) {
			return null;
		}
		return new OtherProfilePage(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.content);
		const params = new URLSearchParams(location.search);

		const newDisplayName = params.get("displayName");
		this.loadUserInfo(newDisplayName);
	}

	unload(): void {
		this.content.remove();
	}

	async loadUserInfo(displayName :any) {
			const res = await api.get(`/api/user?displayName=${displayName}`);
			if (!res || !res.payload) return;
			if (res.status != Status.success) {
				return notify("Error: " + res.payload.message, "error");
			}
			const blocked = await api.post("/api/friend/blockedme", { displayName });
			if (blocked?.payload.blocked === true) {
				notify("User not found", "error");
				return gotoPage("profile");
			}
			let userinfo;
		try {
			userinfo = res.payload.user;
			this.displayname.innerText = userinfo.displayName;
			this.username.innerText = userinfo.username;
			const avatarImg = this.content.querySelector<HTMLImageElement>("#profile-picture");
			if (avatarImg)
				avatarImg.src = userinfo.avatar.startsWith("/") ? userinfo.avatar : `/${userinfo.avatar}`;
		} catch {
		}
		const statusDot = this.content.querySelector("#status-dot");
		const statusText = this.content.querySelector("#status-text");
		const contMatchList = this.content.querySelector("#match-list");
		const cntFriendButton = this.content.querySelector(".friend-buttons");

		if (!contMatchList || !statusDot || !statusText || !cntFriendButton)
		{
			return;
		}

		statusText.innerHTML = "";
		contMatchList.innerHTML = "";
		const isOnline = userinfo.isOnline;
		statusDot.className = isOnline ? "friend-round-online" : "friend-round-offline";
		statusText.className = isOnline ? "friend-text-online" : "friend-text-offline";
		statusText.textContent = isOnline ? "Online" : "Offline";

		const resMatch = await api.get(`/api/user/history?displayName=${displayName}`);
		if (!resMatch || resMatch.status != Status.success) {
			notify("Can't load matchs info", "error");
			return;
		}

		const resMe = await api.get(`/api/me`);
		if (!resMe || resMe.status != Status.success) {
			notify("Can't load my info", "error");
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
					resMe.payload.displayName
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

		const resStat = await api.get(`/api/user/stats?displayName=${displayName}`);

		if (!resStat || resStat.status != Status.success)
			return notify("Can't load my stats", "error");

		const Stat = resStat.payload;

		infoPlayedMatch.textContent = Stat.matchPlayed;
		infoVictoryRate.textContent = Stat.victoryRate + "%";
		infoPointsScored.textContent = Stat.pointScored;
		infoPointsTanked.textContent = Stat.pointConceded;
		infoTourPlayed.textContent = Stat.nbTournament + " / " + Stat.nbTournamentVictory;
		infoTourPlacement.textContent = Stat.Placement;

		const oldButton = cntFriendButton.querySelector("#friend-buttons-cnt");
		if (oldButton)
			oldButton.remove();

		const friendButton = new FriendButton(userinfo.displayName);
		friendButton.container.id= "friend-buttons-cnt";
		cntFriendButton.appendChild(friendButton.getFriendButton());
	}
};
