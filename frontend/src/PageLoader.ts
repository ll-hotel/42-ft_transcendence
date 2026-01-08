import AppPage from "./pages/AppPage.js";
import newHomePage from "./pages/HomePage.js";
import { Login } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";
import { ProfilePage } from "./pages/profile.js"
import Play from "./pages/play.js";
import PlayLocal from "./pages/play_local.js";
import PlayMatch from "./pages/play_match.js";
import PlayTournament from "./pages/play_tournament.js";

const pages: { name: string, new: (e: HTMLElement) => AppPage | null }[] = [
	{ name: "home", new: newHomePage },
	{ name: "register", new: RegisterPage.new },
	{ name: "login", new: Login.new },
	{ name: "profile", new: ProfilePage.new },
	{ name: "play", new: Play.new },
	{ name: "play/local", new: PlayLocal.new },
	{ name: "play/match", new: PlayMatch.new },
	{ name: "play/tournament", new: PlayTournament.new },
];

export function strToPageName(str: string): string | null {
	for (const page of pages) {
		if (page.name == str) return str;
	}
	return null;
}

class PageLoader {
	list: Map<string, AppPage>;
	loaded: string | null;
	content: HTMLElement;

	constructor(loadPlace: HTMLElement) {
		this.list = new Map();
		this.loaded = null;
		this.content = loadPlace;
	}

	async downloadPages() {
		const downloads = pages.map(p => this.download(p.name));
		for (const download of downloads) {
			await download;
		}
	}

	load(name: string) {
		if (!this.list.has(name)) return;
		if (this.loaded) {
			this.list.get(this.loaded)!.unload();
		}
		this.loaded = name;
		this.list.get(this.loaded)!.loadInto(this.content);
		document.title = name;
	}

	async download(name: string) {
		const pageName = strToPageName(name);
		if (pageName == null || this.list.has(pageName)) {
			return;
		}
		const html = await downloadHtmlBody(pageName);
		const page = pages.find(p => p.name == pageName)!.new(html);
		if (page === null) {
			return alert("Could not load " + pageName);
		}
		this.list.set(name, page);
	}
};

async function downloadHtmlBody(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
	return await fetch(`/${encodeURI(path + ".html")}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res => res.text().then(text => (new DOMParser).parseFromString(text, "text/html").body));
}

const loader = new PageLoader(document.body.querySelector("#content")!);

export async function gotoPage(name: string, search: string = "") {
	const pageName = strToPageName(name);
	if (pageName == null || (loader.loaded && loader.loaded == pageName)) {
		return;
	}
	history.pushState(null, "", "/" + pageName + search);
	await loader.downloadPages();
	loader.load(pageName);
}

(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
	const page = strToPageName(location.pathname.substring(1)) || "login";
	loader.load(page);
}
