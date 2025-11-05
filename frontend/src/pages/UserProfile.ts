import { request_api } from "../api.js";
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
	    container.appendChild(this.content);
		window.cookieStore.get("access_token").then((token) => {
			if (token == null) {
				console.log("[userprofile] Redirecting to login page");
				window.location.replace("#auth");
			}
		});
	}
	unload(): void {
	    this.content.remove();
	}

	async logoutClick() {
		const accessToken = await window.cookieStore.get("access_token");
		if (!accessToken) {
			console.log("You are not logged in");
			window.location.replace("#auth");
		}
		const reply = await request_api("/api/auth/logout");
		if (reply.status == 401) {
			// Unauthorized = not logged in or wrong user.
			// Not doing anything for now.
		}
		window.location.replace("#auth");
	}
};
