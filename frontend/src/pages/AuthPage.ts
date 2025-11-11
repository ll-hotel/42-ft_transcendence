import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import AppPage from "./AppPage.js";

export class AuthPage implements AppPage {
	content: HTMLElement;
	error: HTMLElement;
	form: HTMLFormElement;

	private constructor(html: HTMLElement) {
		this.content = html.querySelector("#auth-content")!;
		this.error = this.content.querySelector("#auth-error")!;
		this.form = this.content.querySelector("#auth-form")! as HTMLFormElement;
		this.form.addEventListener("submit", (e) => this.onsubmit(e));
	}

	static new(html: HTMLElement): AuthPage | null {
		const content = html.querySelector("#auth-content");
		const error = content?.querySelector("#auth-error");
		const form = content?.querySelector("#auth-form");
		if (!content || !error || !form) {
			console.log("[auth] Missing html");
			return null;
		}
		return new AuthPage(html);
	}

	async loadInto(container: HTMLElement) {
		const token = localStorage.getItem("access_token");
		if (token != null) {
			console.log("[auth] Already logged in, redirecting");
			gotoPage("home");
			return;
		}
		this.form.reset();
		container.appendChild(this.content);
	}

	unload() {
		this.error.innerHTML = "";
		this.content.remove();
	}

	setError(error: string) {
		this.error.innerHTML = error;
		if (this.error.innerHTML.length == 0) {
			this.error.setAttribute("hidden", "");
		} else {
			this.error.removeAttribute("hidden");
		}
	}

	onsubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.submitter?.parentElement! as HTMLFormElement;
		const data = new FormData(form);
		const username = data.get("username")?.toString() || "";
		const password = data.get("password")?.toString() || "";
		const REGEX_USERNAME = /^(?=^[a-zA-Z])\w{3,24}$/;
		const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;
		if (REGEX_USERNAME.test(username.toString()) == false) {
			this.setError("Username must contain at least 3 letters or digits and start with a letter.");
			form.setAttribute("class", ":invalid");
			return;
		}
		if (REGEX_PASSWORD.test(password.toString()) == false) {
			this.setError("Password must contain at least 1 lowercase, 1 uppercase, 1 digit and 8 characters.");
			form.setAttribute("class", ":invalid");
			return;
		}
		if (event.submitter!.id == "register-submit") {
			this.apiRegister(username.toString(), password.toString());
		} else if (event.submitter!.id == "login-submit") {
			this.apiLogin(username.toString(), password.toString());
		}
	};

	async apiRegister(username: string, password: string) {
		const reply = await api.post("/api/auth/register", {
			username,
			password,
			displayName: username,
			twofa: false,
		});
		if (!reply) return;
		const { status, payload } = reply;
		if (status != Status.created) {
			return this.setError(payload.message);
		}
		this.apiLogin(username, password);
	}

	async apiLogin(username: string, password: string) {
		const reply = await api.post("/api/auth/login", {
			username,
			password,
		});
		if (!reply) return;
		const { status, payload } = reply;
		if (status == Status.success) {
			localStorage.setItem("access_token", payload.access_token);
			gotoPage("home");
			return;
		}
		if (status == Status.bad_request) {
			if (!payload.logged_in) {
				localStorage.removeItem("access_token");
				return this.setError(payload.message);
			}
			localStorage.setItem("access_token", payload.access_token)
			gotoPage("home");
		}
	}
};
