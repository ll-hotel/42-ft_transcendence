import { api } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export class Login implements AppPage {
	content: HTMLElement;
	form: HTMLFormElement;

	constructor(content: HTMLElement) {
		this.content = content;
		this.form = content.querySelector("form")!;
		this.form.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitForm();
			return false;
		});
	}
	static new(content: HTMLElement) {
		if (!content.querySelector("form")) {
			return null;
		}
		return new Login(content);
	}

	loadInto(container: HTMLElement): void {
		if (localStorage.getItem("access_token")) {
			// Already connected. Redirecting to user profile page.
			gotoPage("userprofile");
			return;
		}
		container.appendChild(this.content);
	}
	unload(): void {
		this.content.remove();
		(this.form.querySelector("[name=username]")! as HTMLInputElement).value = "";
		(this.form.querySelector("[name=password]")! as HTMLInputElement).value = "";
	}
	async submitForm() {
		const data = new FormData(this.form);
		const username = data.get("username");
		const password = data.get("password");

		const res = await api.post("/api/auth/login", { username, password })
		if (!res) {
			return alert("Invalid API response.");
		}
		if (!res.payload.logged_in) {
			return alert("Error: " + res.payload.message);
		}
		localStorage.setItem("access_token", res.payload.access_token);
		await gotoPage("userprofile");
	}
}
