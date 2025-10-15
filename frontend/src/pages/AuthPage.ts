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
		this.form.addEventListener("submit", function(event): boolean {
			const form_data = new FormData(this.form);
			const username = form_data.get("username") || "";
			const password = form_data.get("password") || "";
			if (event.submitter!.id == "register-submit") {
				return this.register(username, password);
			} else if (event.submitter!.id == "login-submit") {
				return this.login(username, password);
			}
			return false;
		});
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

	register(username: string, password: string): boolean {
		if (username.length < 3) {
			alert("Username too short");
			return false;
		}
		if (password.length < 8) {
			alert("Password too short");
			return false;
		}
		request_api("/api/register", { username, password })
		.then(function (res) {
			alert(res.message);
		}).catch(function (err) {
			alert("Failed to register");
			console.log(err);
		});
		return true;
	}

	login(username: string, password: string): boolean {
		if (username.length < 3) {
			alert("Username too short");
			return false;
		}
		if (password.length < 8) {
			alert("Password too short");
			return false;
		}
		request_api("/api/login", { username, password })
		.then(function (res) {
			alert(res.message);
		}).catch(function (err) {
			alert("Failed to log in");
			console.log(err);
		});
		return true;
	}
};
