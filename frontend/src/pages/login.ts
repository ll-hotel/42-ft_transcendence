import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export class Login implements AppPage {
	content: HTMLElement;
	form: HTMLFormElement;
	twoFAHidden: boolean;

	constructor(content: HTMLElement) {
		this.content = content;
		this.form = content.querySelector("form")!;
		this.form.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitForm();
			return false;
		});
		this.twoFAHidden = true;
	}
	static new(content: HTMLElement) {
		if (!content.querySelector("form")) {
			return null;
		}
		return new Login(content);
	}

	loadInto(container: HTMLElement): void {
		if (localStorage.getItem("accessToken")) {
			// Already connected. Redirecting to user profile page.
			gotoPage("home");
			return;
		}
		container.appendChild(this.content);
	}
	unload(): void {
		this.content.remove();
		(this.form.querySelector("[name=username]")! as HTMLInputElement).value = "";
		(this.form.querySelector("[name=password]")! as HTMLInputElement).value = "";
		(this.form.querySelector("[name=twoFACode]")! as HTMLInputElement).value = "";
	}
	async submitForm() {
		const data = new FormData(this.form);
		const username = data.get("username");
		const password = data.get("password");
		const twoFACode = data.get("twoFACode");

		const res = await api.post("/api/auth/login", { username, password, twoFACode })
		if (!res) {
			return alert("Invalid API response.");
		}
		if (!this.twoFAHidden) {
			this.toggleTwoFA();
		}
		if (res.status === Status.success || res.payload.loggedIn) {
			localStorage.setItem("accessToken", res.payload.accessToken);
			return gotoPage("userprofile");
		}
		if (res.payload.twoFAEnabled) {
			this.toggleTwoFA();
			return;
		}
		alert("Error: " + res.payload.message);
	}
	toggleTwoFA() {
		if (this.twoFAHidden) {
			this.form.querySelector("#form-username")?.setAttribute("hidden", "");
			this.form.querySelector("#form-password")?.setAttribute("hidden", "");
			this.content.querySelector("#button-intra")?.setAttribute("hidden", "");
			this.content.querySelector("#button-register")?.setAttribute("hidden", "");
			this.form.querySelector("#form-twoFACode")?.removeAttribute("hidden");
			this.twoFAHidden = false;
		} else {
			this.form.querySelector("#form-username")?.removeAttribute("hidden");
			this.form.querySelector("#form-password")?.removeAttribute("hidden");
			this.content.querySelector("#button-intra")?.removeAttribute("hidden");
			this.content.querySelector("#button-register")?.removeAttribute("hidden");
			const twoFACodeForm = this.form.querySelector("#form-twoFACode");
			if (twoFACodeForm) {
				twoFACodeForm.setAttribute("hidden", "");
				const twoFACodeInput = twoFACodeForm.querySelector("input");
				if (twoFACodeInput) twoFACodeInput.value = "";
			}
			this.twoFAHidden = true;
		}
	}
}
