import AppPage from "./pages/AppPage.js";
import { editProfile } from "./pages/editProfile.js";
import { ChatPage } from "./pages/chatPage.js";
import { HomePage } from "./pages/HomePage.js";
import { Login } from "./pages/login.js";
import Play from "./pages/play.js";
import PlayLocal from "./pages/play/local.js";
import PlayMatch from "./pages/play/match.js";
import { OtherProfilePage } from "./pages/otherProfile.js";
import { ProfilePage } from "./pages/profile.js";
import { RegisterPage } from "./pages/register.js";
import { Tournament } from "./pages/tournament.js";
import { Tournaments } from "./pages/tournaments.js";
import { notify } from "./utils/notifs.js";
import {MatchMaking} from "./pages/matchmaking.js";
import socket from "./socket.js";

const pages: { name: string, new: (e: HTMLElement) => Promise<AppPage | null> }[] = [
	{ name: "home", new: HomePage.new },
	{ name: "register", new: RegisterPage.new },
	{ name: "login", new: Login.new },
	{ name: "profile", new: ProfilePage.new },
	{ name: "profile/other", new: OtherProfilePage.new },
	{ name: "profile/edit", new: editProfile.new },
	{ name: "chat", new: ChatPage.new },
	{ name : "play", new: Play.new},
	{ name: "play/local", new: PlayLocal.new },
	{ name: "play/match", new: PlayMatch.new },
	{ name: "tournament", new: Tournament.new },
	{ name: "tournaments", new: Tournaments.new },
	{ name: "matchmaking", new: MatchMaking.new}
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
		const page = await pages.find(p => p.name == pageName)!.new(html);
		if (page === null) {
			return notify("Could not load " + pageName, "error");
		}
		this.list.set(name, page);
	}
}

async function downloadHtmlBody(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
	const element = await fetch(`/${encodeURI(path + ".html")}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res =>
		res.text().then(text => (new DOMParser()).parseFromString(text, "text/html").body.firstElementChild)
	);

	if (!element) {
		throw new Error(`No elements fond at ${path}`);
	}
	return element as HTMLElement;
}

export async function gotoUserPage(displayName: string) {
	await gotoPage("profile/other", "?displayName=" + displayName);
}

const loader = new PageLoader(document.getElementById("content")!);

export async function gotoPage(name: string, search: string = "") {
	let pageName = strToPageName(name);
	if (pageName == null || (loader.loaded && loader.loaded === pageName && location.search === search)) {
		return;
	}
	history.pushState(null, "", "/" + pageName + search);
	await loadPage(true);
}

async function loadPage(replaceState: boolean) {
	const path = location.pathname.substring(1);
	let pageName = strToPageName(path) || "home";	

	if (!await socket.connect() && !(pageName === "register" || pageName === "login")) {
		pageName = "login";
		if (replaceState) {
			history.replaceState(null, "", "/login");
		}
	}

	await loader.downloadPages();
	loader.load(pageName);
}

(window as any).gotoPage = gotoPage;

window.onpopstate = function () {
	loadPage(false);
};
