import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import { FriendButton } from "../friendButton.js";
import AppPage from "./AppPage.js"
import { MatchInfo } from "./profile/matches.js";

export class OtherProfilePage implements AppPage {
	content: HTMLElement;
	displayname: HTMLElement;
	username: HTMLElement;
	private actualDisplayname: string | null = null;

	private constructor(content: HTMLElement) {
		this.content = content;
		this.displayname = content.querySelector("#profile-displayname")!;
		this.username = content.querySelector("#profile-username")!;
	}
	static new(content: HTMLElement) {
		const displayname = content.querySelector("#profile-displayname");
		// const username = content.querySelector("#profile-username")!;
		// if (!content || !logout || !displayname || !username) {
		if (!content || !displayname) {
			return null;
		}
		return new OtherProfilePage(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.content);

		if (this.actualDisplayname)
			this.loadUserInfo(this.actualDisplayname);
	}

	unload(): void {
		this.content.remove();
	}

	async loadUserInfo(displayName :any) {
			const res = await api.get(`/api/user?displayName=${displayName}`);
			if (!res || !res.payload) return;
			if (res.status != Status.success) {
				return alert("Error: " + res.payload.message);
			}
			let userinfo;
		try {
			userinfo = res.payload.user;
			this.displayname.innerHTML = userinfo.displayName;
		} catch {
			// If JSON.parse throws then our local user info is corrupted.

			return;
		}
		const statusDot = this.content.querySelector("#status-dot");
		const statusText = this.content.querySelector("#status-text");
		const matchList = this.content.querySelector("#match-list");
		const cntFriendButton = this.content.querySelector(".friend-buttons");
		
		if (!matchList || !statusDot || !statusText)
		{
			return;
		}
		
		statusText.innerHTML = "";
		const isOnline = userinfo.isOnline;
		statusDot.className = isOnline ? "friend-round-online" : "friend-round-offline";
		statusText.className = isOnline ? "friend-text-online" : "friend-text-offline";
		statusText.textContent = isOnline ? "Online" : "Offline";

		matchList.innerHTML = "";
		for (let i = 0; i < 5; i += 1) {
			matchList.append(MatchInfo.new("01/01/25", "0:0:0",
				{ name: userinfo.displayName, score: 0 },
				{ name: "Tanguos", score: 12 }
			).toHTML());
		}

		if (cntFriendButton)
		{
			const oldButton = cntFriendButton.querySelector("#friend-buttons-cnt");
			if (oldButton)
				oldButton.remove();
		}
		
		const friendButton = new FriendButton(displayName);
		friendButton.container.id= "friend-buttons-cnt";
		cntFriendButton?.appendChild(friendButton.getFriendButton());
	}

	setParams(params: any) {
		if (!params || !params.displayName)
			return;

		this.actualDisplayname = params.displayName;

		if(this.content.isConnected)
			this.loadUserInfo(params.displayName);
	}
};
