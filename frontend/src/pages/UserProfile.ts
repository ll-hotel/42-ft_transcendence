import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js"

export class UserProfile implements AppPage {
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
		const profile = content.querySelector("#profile");
		const logout = content.querySelector("#logout");
		const displayname = content.querySelector("#profile-displayname");
		const username = content.querySelector("#profile-username")!;
		if (!content || !profile || !logout || !displayname || !username) {
			return null;
		}
		return new UserProfile(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		const token = localStorage.getItem("accessToken");
		if (!token) {
			return gotoPage("login");
		}
		container.appendChild(this.content);
		return this.loadUserInfo();
	}

	unload(): void {
		this.content.remove();
	}

	async loadUserInfo() {
		let localUserInfo = localStorage.getItem("userinfo");
		if (!localUserInfo) {
			const res = await api.get("/api/me");
			if (!res || !res.payload) return;
			if (res.status != Status.success) {
				return alert("Error: " + res.payload.message);
			}
			localUserInfo = JSON.stringify(res.payload);
			localStorage.setItem("userinfo", localUserInfo);
		}
		try {
			const userinfo = JSON.parse(localUserInfo);
			this.displayname.innerHTML = userinfo.displayName;
		} catch {
			// If JSON.parse throws then our local user info is corrupted.
			localStorage.removeItem("userinfo");
			await this.logoutClick();
		}
	}

	async logoutClick() {
		const reply = await api.post("/api/auth/logout");
		if (!reply || reply.status == Status.unauthorized) {
			// Unauthorized = not logged in or wrong user.
		}
		localStorage.removeItem("accessToken");
		localStorage.removeItem("userinfo");
		await gotoPage("login");
	}
};
