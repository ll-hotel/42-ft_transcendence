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
		const intraButton: HTMLButtonElement = this.content.querySelector("button#button-intra")!;
		intraButton.onclick = async function() {
			const res = await api.get("/api/auth42");
			if (!res || !res.payload.redirect) {
				return;
			}
			location.assign(res.payload.redirect);
		};
	}
	static new(content: HTMLElement) {
		if (!content.querySelector("form") ||
			!content.querySelector("button#button-intra")) {
			return null;
		}
		return new Login(content);
	}

	async loadInto(container: HTMLElement) {
		const searchKey = "?code=";
		if (location.search.startsWith(searchKey)) {
			const logging = document.createElement("p");
			logging.className = "font-bold text-xl";
			logging.innerText = "Logging in...";
			container.appendChild(logging);

			const searchArgs = location.search.substring(1).split("&");
			const searchCode = searchArgs.find(s => s.startsWith("code="))!;
			const code = searchCode.split("=")[1];
			const res = await api.get("/api/auth42/callback?code=" + code);
//			if (res && res.payload.accessToken) {
//				localStorage.setItem("accessToken", res.payload.accessToken);
//			}
			logging.remove();
		}
//		if (localStorage.getItem("accessToken")) {
			// Already connected. Redirecting to user profile page.
//			gotoPage("profile");
//			return;
//		}
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
			return gotoPage("profile");
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
