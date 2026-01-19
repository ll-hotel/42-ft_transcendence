import AppPage from "./pages/AppPage.js";
import { editProfile } from "./pages/editProfile.js";
import { FriendPage } from "./pages/FriendPage.js";
import newHomePage from "./pages/HomePage.js";
import { Login } from "./pages/login.js";
import { OtherProfilePage } from "./pages/otherProfile.js";
import { ProfilePage } from "./pages/profile.js";
import { RegisterPage } from "./pages/register.js";
import { Tournament } from "./pages/tournament.js";
import { Tournaments } from "./pages/tournaments.js";
import { notify } from "./utils/notifs.js";

const pages: { name: string, new: (e: HTMLElement) => AppPage | null }[] = [
	{ name: "home", new: newHomePage },
	{ name: "register", new: RegisterPage.new },
	{ name: "login", new: Login.new },
	{ name: "profile", new: ProfilePage.new },
	{ name: "tournament", new: Tournament.new },
	{ name: "tournaments", new: Tournaments.new },
	{ name: "profile/other", new: OtherProfilePage.new },
	{ name: "profile/edit", new: editProfile.new },
	{ name: "friends", new: FriendPage.new },
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
			return notify("Could not load " + pageName, "error");
		}
		this.list.set(name, page);
	}
}

async function downloadHtmlBody(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
	return await fetch(`/${encodeURI(path + ".html")}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res => res.text().then(text => (new DOMParser()).parseFromString(text, "text/html").body));
}

export async function gotoUserPage(displayName: string) {
	await gotoPage("profile/other", "?displayName=" + displayName);
}
const loader = new PageLoader(document.body.querySelector("#content")!);

export async function gotoPage(name: string, search: string = "") {
	const pageName = strToPageName(name);
	if (pageName == null || (loader.loaded && loader.loaded === pageName && location.search === search)) {
		return;
	}
	history.pushState(null, "", "/" + pageName + search);
	await loadPage();
}

async function loadPage() {
	const path = location.pathname.substring(1);
	const pageName = strToPageName(path) || "login";

	await loader.downloadPages();
	loader.load(pageName);
}

(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
	loadPage();
};
