import AppPage from "./pages/AppPage.js";
import { HomePage } from "./pages/HomePage.js";
import { PongPage } from "./pages/PongPage.js";
import { Login } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";
import { ProfilePage } from "./pages/profile.js"

enum Pages {
	home = "home.html",
	pong = "pong.html",
	register = "register.html",
	login = "login.html",
	profile = "profile.html",
};
export type PageName = keyof typeof Pages;

export function strToPageName(str: string): PageName | null {
	switch (str) {
		case "home": return "home";
		case "pong": return "pong";
		case "register": return "register";
		case "login": return "login";
		case "profile": return "profile";
	}
	return null;
}

class PageLoader {
	list: Map<PageName, AppPage>;
	loaded: PageName | null;
	content: HTMLElement;

	constructor(loadPlace: HTMLElement) {
		this.list = new Map();
		this.loaded = null;
		this.content = loadPlace;
	}

	async downloadPages() {
		const downloads = [
			this.download("home"),
			this.download("register"),
			this.download("login"),
			this.download("profile"),
			this.download("pong"),
		];
		for (const download of downloads) {
			await download;
		}
	}

	load(name: PageName) {
		if (!this.list.has(name)) return;
		if (this.loaded) {
			this.list.get(this.loaded)!.unload();
		}
		this.loaded = name;
		this.list.get(this.loaded)!.loadInto(this.content);
		document.title = name;
	}

	async download(name: PageName) {
		if (this.list.has(name)) return;
		let newPage: (html: HTMLElement) => Promise<AppPage | null>;
		switch (name) {
			case "home": newPage = HomePage.new; break;
			case "pong": newPage = PongPage.new; break;
			case "register": newPage = RegisterPage.new; break;
			case "login": newPage = Login.new; break;
			case "profile": newPage = ProfilePage.new; break;
		}
		const html = await downloadHtmlBody(Pages[name]);
		const page = await newPage(html);
		if (page === null) {
			return alert("Could not load " + Pages[name]);
		}
		this.list.set(name, page);
	}
};

async function downloadHtmlBody(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
	return await fetch(`/${encodeURI(path)}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res => res.text().then(text => (new DOMParser).parseFromString(text, "text/html").body));
}

const loader = new PageLoader(document.body.querySelector("#content")!);

export async function gotoPage(name: PageName) {
	if (name != "login" && name != "register") {
		const token = localStorage.getItem("accessToken");
		if (!token) {
			name = "login";
		}
	}
	if (loader.loaded && loader.loaded == name) {
		return;
	}
	if (name == "login") {
		history.pushState(null, "", "/" + name + location.search);
	} else {
		history.pushState(null, "", "/" + name);
	}
	await loader.downloadPages();
	loader.load(name);
}

(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
	const page = strToPageName(location.pathname.substring(1)) || "login";
	loader.load(page);
}
