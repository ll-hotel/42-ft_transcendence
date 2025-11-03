import AppPage from "./pages/AppPage.js";
import newAuthPage from "./pages/AuthPage.js";
import newHomePage from "./pages/HomePage.js";
import newPongPage from "./pages/PongPage.js";

enum Pages {
	home = "home.html",
	auth = "auth.html",
	pong = "pong.html",
};
export type PageName = keyof typeof Pages;

export function strToPageName(str: string): PageName | null {
	switch (str) {
		case "home": return "home";
		case "auth": return "auth";
		case "pong": return "pong";
	}
	return null;
}

export default class PageLoader {
	list: Map<PageName, AppPage>;
	loaded_page: AppPage | null;
	content: HTMLElement;

	constructor(loadPlace: HTMLElement = document.body) {
		this.list = new Map();
		this.loaded_page = null;
		this.content = loadPlace;
	}

	async downloadPages() {
		await this.download("home");
		await this.download("auth");
		await this.download("pong");
	}

	load(name: PageName) {
		if (!this.list.has(name)) return;
		if (this.loaded_page) {
			this.loaded_page.unload();
		}
		this.loaded_page = this.list.get(name)!;
		this.loaded_page.loadInto(this.content);
	}

	async download(name: PageName) {
		let newPage: (html: HTMLElement) => AppPage | null;
		switch (name) {
			case "home": newPage = newHomePage; break;
			case "auth": newPage = newAuthPage; break;
			case "pong": newPage = newPongPage; break;
		}
		const html = await downloadHtmlBody(Pages[name]);
		const page = newPage(html);
		if (page === null) {
			return alert("Could not load " + Pages[name]);
		}
		this.list.set(name, page);
	}
};

async function downloadHtmlBody(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
    return await fetch(`https://${window.location.hostname}/${encodeURI(path)}`, {
        method: "GET",
        headers: { "Accept": "text/html" },
        credentials: "include",
        cache,
    }).then(res => res.text().then(text => (new DOMParser).parseFromString(text, "text/html").body));
}
