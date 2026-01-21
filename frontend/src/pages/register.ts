import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";
import { notify } from "./utils/notifs.js";

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
	static async new(content: HTMLElement): Promise<AppPage | null> {
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
		document.querySelector("#navbar")?.setAttribute("hidden", "");
	}
	unload(): void {
		document.querySelector("#navbar")?.removeAttribute("hidden");
		this.content.remove();
		(this.form.querySelector("[name=username]")! as HTMLInputElement).value = "";
		(this.form.querySelector("[name=password]")! as HTMLInputElement).value = "";
	}
	async submitForm() {
		const data = new FormData(this.form);
		const username = data.get("username")?.toString() || "";
		const password = data.get("password")?.toString() || "";

		const res = await api.post("/api/auth/register", { username, password, displayName: username });
		if (!res) {
			return notify("Invalid API response.", "error");
		}
		if (res.status != Status.created) {
			return notify(res.payload.message, "error");
		}
		if (res.status == Status.created) {
			notify("User successfuly created", "success");
		}
		await gotoPage("login");
	}
}
