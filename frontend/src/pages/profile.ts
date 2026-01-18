import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js"
import { MatchInfo } from "./profile/matches.js";

export class ProfilePage implements AppPage {
	content: HTMLElement;
	displayname: HTMLElement;
	username: HTMLElement;

	private constructor(content: HTMLElement) {
		this.content = content;
		this.displayname = content.querySelector("#profile-displayname")!;
		this.username = content.querySelector("#profile-username")!;
		const logout = content.querySelector("#logout") as HTMLElement;
		logout.onclick = () => this.logoutClick();
	}
	static new(content: HTMLElement) {
		const logout = content.querySelector("#logout");
		const displayname = content.querySelector("#profile-displayname");
		// const username = content.querySelector("#profile-username")!;
		// if (!content || !logout || !displayname || !username) {
		if (!content || !logout || !displayname) {
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
			gotoPage("login");
			return;
		}
		const userInfo = res.payload as { displayName: string };
		this.displayname.innerHTML = userInfo.displayName;

		const matchList = this.content.querySelector("#match-list");
		if (matchList && matchList.children.length == 0) {
			for (let i = 0; i < 5; i += 1) {
				matchList.append(MatchInfo.new("01/01/25", "0:0:0",
					{ name: this.displayname.innerHTML, score: 0 },
					{ name: "Tanguos", score: 12 }
				).toHTML());
			}
		}
	}

	async logoutClick() {
		const reply = await api.post("/auth-service/auth/logout");
		if (!reply || reply.status == Status.unauthorized) {
			// Unauthorized = not logged in or wrong user.
		}
		await gotoPage("login");
	}
};
