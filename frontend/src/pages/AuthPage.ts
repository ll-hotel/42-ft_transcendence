import AppPage from "./AppPage.js";

export default function newAuthPage(html: HTMLElement): AuthPage | null {
	const content = html.querySelector("#auth-content");
	const form = html.querySelector("#auth-form");
	if (form == null || content == null) {
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
		this.form = html.querySelector("#auth-form")! as HTMLFormElement;
		this.form.addEventListener("submit", submitEventListener);
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
};

function submitEventListener(event: SubmitEvent) {
		event.preventDefault();
		const form = event.submitter?.parentElement! as HTMLFormElement;
		const data = new FormData(form);
		const username = data.get("username")?.toString() || "";
		const password = data.get("password")?.toString() || "";
		const REGEX_USERNAME = /^(?=^[a-zA-Z])\w{3,24}$/;
		const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;
		if (REGEX_USERNAME.test(username.toString()) == false) {
			alert("Username must contain at least 3 letters or digits and start with a letter.");
			form.setAttribute("class", ":invalid");
			return;
		}
		if (REGEX_PASSWORD.test(password.toString()) == false) {
			alert("Password must contain at least 1 lowercase, 1 uppercase, 1 digit and 8 characters.");
			form.setAttribute("class", ":invalid");
			return;
		}
		if (event.submitter!.id == "register-submit") {
			register(username.toString(), password.toString());
		}
		else if (event.submitter!.id == "login-submit") {
			login(username.toString(), password.toString());
		}
	}

function register(username: string, password: string) {
    alert("Not implemented.");
}

function login(username: string, password: string) {
    alert("Not implemented.");
}
