import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export class RegisterPage implements AppPage {
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
		return new RegisterPage(content);
	}

	async loadInto(container: HTMLElement): Promise<void> {
		const me = await api.get("/api/me");
		if (me && me.status === Status.success) {
			// Already connected. Redirecting to user profile page.
			gotoPage("profile");
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
		const username = data.get("username")?.toString() || "";
		const password = data.get("password")?.toString() || "";
		const twofa = data.get("twofa")?.valueOf() || false;

		const res = await api.post("/auth-service/auth/register", { username, password, displayName: username, twofa })
		if (!res) {
			return alert("Invalid API response.");
		}
		if (res.status != Status.created) {
			return alert("Error: " + res.payload.message);
		}
		if (res.payload.qrCode) {
			window.open(res.payload.qrCode);
		}
		await gotoPage("login");
	}
}
