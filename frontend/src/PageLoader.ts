import AppPage from "./pages/AppPage.js";
import { AuthPage } from "./pages/AuthPage.js";
import newHomePage from "./pages/HomePage.js";
import { UserProfile } from "./pages/UserProfile.js"

enum Pages {
	home = "home.html",
	auth = "auth.html",
	userprofile = "userprofile.html",
};
export type PageName = keyof typeof Pages;

export function strToPageName(str: string): PageName | null {
	switch (str) {
		case "home": return "home";
		case "auth": return "auth";
		case "userprofile": return "userprofile";
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
		await this.download("home");
		await this.download("auth");
		await this.download("userprofile");
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
		let newPage: (html: HTMLElement) => AppPage | null;
		switch (name) {
			case "home": newPage = newHomePage; break;
			case "auth": newPage = AuthPage.new; break;
			case "userprofile": newPage = UserProfile.new; break;
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

const loader = new PageLoader(document.body.querySelector("#content")!);

export async function gotoPage(name: PageName) {
	history.pushState({ page: loader.loaded }, "", "/" + name);
	await loader.downloadPages();
	loader.load(name);
}

(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
	const page = strToPageName(location.pathname.substring(1)) || "auth";
	loader.load(page);
}
