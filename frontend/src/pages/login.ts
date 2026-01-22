import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import socket from "../socket.js";
import AppPage from "./AppPage.js";
import { notify } from "../utils/notifs.js";

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
		const googleButton: HTMLButtonElement = this.content.querySelector("button#button-google")!;
		googleButton.onclick = async function() {
			const res = await api.get("/api/authGoogle");
			if (!res || !res.payload.redirect) {
				return;
			}
			location.assign(res.payload.redirect);
		};
	}
	static new(content: HTMLElement) {
		if (
			!content.querySelector("form")
			|| !content.querySelector("button#button-intra")
			|| !content.querySelector("button#button-google")
		) {
			return null;
		}
		return new Login(content);
	}

	async loadInto(container: HTMLElement) {
		this.hideTwofa();
		container.appendChild(this.content);

		const params = new URLSearchParams(location.search);
		const provider = params.get("provider");
		const code = params.get("code");
		if (code && provider) {
			return loginWithProvider(container, provider, code);
		}
		if (await socket.connect()) {
			return gotoPage("profile");
		}
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

		const res = await api.post("/api/auth/login", { username, password, twoFACode });
		if (!res) {
			return this.hideTwofa();
		}
		if (res.status === Status.success || res.payload.loggedIn) {
			socket.connect();
			notify(res.payload.message, "success");
			return gotoPage("profile");
		}
		if (res.payload.twoFAEnabled) {
			return this.showTwofa();
		}
		notify(res.payload.message, "error");
	}
	hideTwofa() {
		this.form.querySelector("#form-username")?.removeAttribute("hidden");
		this.form.querySelector("#form-password")?.removeAttribute("hidden");
		this.content.querySelector("#button-intra")?.removeAttribute("hidden");
		this.content.querySelector("#button-google")?.removeAttribute("hidden");
		this.content.querySelector("#button-register")?.removeAttribute("hidden");
		this.form.reset();
		this.twoFAHidden = true;
	}
	showTwofa() {
		this.form.querySelector("#form-username")?.setAttribute("hidden", "");
		this.form.querySelector("#form-password")?.setAttribute("hidden", "");
		this.content.querySelector("#button-intra")?.setAttribute("hidden", "");
		this.content.querySelector("#button-google")?.setAttribute("hidden", "");
		this.content.querySelector("#button-register")?.setAttribute("hidden", "");
		this.form.querySelector("#form-twoFACode")?.removeAttribute("hidden");
		this.twoFAHidden = false;
	}
	toggleTwoFA() {
		if (this.twoFAHidden) {
			this.showTwofa();
		} else {
			this.hideTwofa();
		}
	}
}

async function loginWithProvider(container: HTMLElement, provider: string, code: string) {
	let path: string;
	if (provider === "42") {
		path = "/api/auth42/callback?code=";
	} else {
		path = "/api/authGoogle/callback?code=";
	}
	const logging = document.createElement("p");
	logging.className = "font-bold text-xl";
	logging.innerText = "Logging in...";
	container.appendChild(logging);
	const res = await api.get(path + code);
	logging.remove();
	if (!res || !res.payload.loggedIn) {
		notify(res?.payload.message, "error");
		return gotoPage("login");
	}
	notify(res.payload.message, "success");
	await socket.connect();
	return gotoPage("profile");
}
