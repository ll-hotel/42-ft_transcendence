import { api, Status } from "../api.js";
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
	static new(html: HTMLElement) {
		const content = html.querySelector("#user-profile-content");
		const profile = content?.querySelector("#profile");
		const logout = content?.querySelector("#logout");
		const displayname = content?.querySelector("#profile-displayname");
		const username = content?.querySelector("#profile-username")!;
		if (!content || !profile || !logout || !displayname || !username) {
			console.log("[user profile]: Missing html element!");
			return null;
		}
		return new UserProfile(content! as HTMLElement);
	}

	async loadInto(container: HTMLElement) {
		const token = localStorage.getItem("access_token");
		if (!token) {
			console.log("[userprofile] Redirecting to login page");
			window.location.replace("#auth");
			return;
		}
		container.appendChild(this.content);

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
			return;
		}
	}

	unload(): void {
		this.content.remove();
	}

	async logoutClick() {
		localStorage.clear();
		const accessToken = localStorage.getItem("access_token");
		if (!accessToken) {
			console.log("[userprofile] Not logged in. Redirecting.");
			window.location.assign("#auth");
			return;
		}
		const reply = await api.post("/api/auth/logout");
		if (!reply) return;
		if (reply.status == Status.unauthorized) {
			// Unauthorized = not logged in or wrong user.
			// Not doing anything for now.
		}
		window.location.assign("#auth");
	}
};
