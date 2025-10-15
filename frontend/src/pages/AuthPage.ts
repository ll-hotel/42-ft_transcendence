import { request_api } from "../api.js";
import AppPage from "./AppPage.js";

export default function newAuthPage(html: HTMLElement): AuthPage | null {
	const content = html.querySelector("#auth-content");
	const form = html.querySelector("form");
	if (!form || !content) {
		console.log("AuthPage -- missing form or content");
		return null;
	}
	return new AuthPage(html);
}

export class AuthPage implements AppPage {
	html: HTMLElement;
	css: HTMLLinkElement | null;
	content: HTMLElement;
	form: HTMLFormElement;

	constructor(html: HTMLElement) {
		this.html = html;
		this.css = html.querySelector("link");
		this.content = html.querySelector("#auth-content")!;
		this.form = html.querySelector("form")!;
		this.form.addEventListener("submit", this.submitEventListener);
	}

	loadInto(container: HTMLElement) {
		this.form.reset();
		if (this.css) document.head.appendChild(this.css);
		container.appendChild(this.content);
	}

	unload() {
		if (this.css) this.css.remove();
		this.content.remove();
	}

	submitEventListener(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(this.form);
		const username = data.get("username");
		const password = data.get("password");
		const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
		const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;
		if (username == null || REGEX_USERNAME.test(username.toString()) == false) {
			return alert("Username must contain at least 3 letters or digits.");
		}
		if (password == null || REGEX_PASSWORD.test(password.toString()) == false) {
			return alert("Password must contain at least 1 lowercase, 1 uppercase, 1 digit and 8 characters.");
		}
		if (event.submitter!.id == "register-submit") {
			this.register(username.toString(), password.toString());
		}
		else if (event.submitter!.id == "login-submit") {
			this.login(username.toString(), password.toString());
		}
	}

	register(username: string, password: string) {
		request_api("/api/register", { username, password })
		.then(function (res) {
			alert(res.message);
		}).catch(function (err) {
			alert("Failed to register");
			console.log(err);
		});
	}

	login(username: string, password: string) {
		request_api("/api/login", { username, password })
		.then(function (res) {
			alert(res.message);
		}).catch(function (err) {
			alert("Failed to log in");
			console.log(err);
		});
	}
};
