import { request_api, Status } from "../api.js";
import AppPage from "./AppPage.js"

export class UserProfile implements AppPage {
	content: HTMLElement;
	logout: HTMLElement;

	private constructor(content: HTMLElement) {
		this.content = content;
		this.logout = content.querySelector("#logout")!;
		this.logout.onclick = () => this.logoutClick();
	}
	static new(html: HTMLElement) {
		const content = html.querySelector("#user-profile-content");
		const profile = content?.querySelector("#profile");
		const logout = content?.querySelector("#logout");
		if (!content || !profile || !logout) {
			console.log("[user profile]: Missing html element!");
			return null;
		}
		return new UserProfile(content as HTMLElement);
	}
	loadInto(container: HTMLElement): void {
		const token = localStorage.getItem("access_token");
		if (!token) {
			console.log("[userprofile] Redirecting to login page");
			window.location.replace("#auth");
			return;
		}
		container.appendChild(this.content);
	}
	unload(): void {
		this.content.remove();
	}

	async logoutClick() {
		const accessToken = localStorage.getItem("access_token");
		if (!accessToken) {
			console.log("[userprofile] Not logged in. Redirecting.");
			window.location.assign("#auth");
			return;
		}
		const reply = await request_api("/api/auth/logout");
		if (!reply) return;
		if (reply.status == Status.unauthorized) {
			// Unauthorized = not logged in or wrong user.
			// Not doing anything for now.
		}
		localStorage.removeItem("access_token");
		window.location.assign("#auth");
	}
};
