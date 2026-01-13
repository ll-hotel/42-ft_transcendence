import AppPage from "./pages/AppPage.js";
import newHomePage from "./pages/HomePage.js";
import { FriendPage } from "./pages/FriendPage.js";
import { Login } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";
import { ProfilePage } from "./pages/profile.js"
import Play from "./pages/play.js";
import PlayLocal from "./pages/play_local.js";
import PlayMatch from "./pages/play_match.js";
import PlayTournament from "./pages/play_tournament.js";
import { OtherProfilePage } from "./pages/otherProfile.js";
import { editProfile } from "./pages/editProfile.js";

const pages: { name: string, new: (e: HTMLElement) => AppPage | null }[] = [
	{ name: "home", new: newHomePage },
	{ name: "register", new: RegisterPage.new },
	{ name: "login", new: Login.new },
	{ name: "profile", new: ProfilePage.new },
	{ name: "profile/other", new: OtherProfilePage.new},
	{ name: "profile/edit", new: editProfile.new},
	{ name: "friends", new: FriendPage.new},
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
	const element = await fetch(`/${encodeURI(path + ".html")}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res => res.text().then(text => (new DOMParser).parseFromString(text, "text/html").body.firstElementChild));

	if (!element)
		throw new Error(`No elements fond at ${path}`);
	return element as HTMLElement;
	
}

export async function gotoUserPage( displayName : string)
{
	await gotoPage("profile/other", "?displayName=" + displayName);
}
const loader = new PageLoader(document.body.querySelector("#content")!);

/*export async function gotoPage(name: PageName, params?: any) {
//	if (name != "login" && name != "register") {
//		const token = localStorage.getItem("accessToken");
//		if (!token) {
//			name = "login";
//		}
//	}
	if (loader.loaded && loader.loaded == name) {
		const current = loader.list.get(name);
		if (current && current.setParams)
			current.setParams(params);
		return;
	}
	if (name == "login")
		history.pushState(null, "", "/" + name + location.search);
	else if (name != "otherProfile")
		history.pushState({ page: name}, "", "/" + name);
	await loader.download(name);
	loader.load(name);

	const page = loader.list.get(name);
	if (page && page.setParams)
	{
		page.setParams(params);
	}
*/
async function loadPage()
{
		const path = location.pathname.substring(1);
		const pageName = strToPageName(path) || "login";

		await loader.downloadPages();
		loader.load(pageName);

		const page = loader.list.get(pageName);
		if (page && page.setParams)
			page.setParams(location.search);
}

export async function gotoPage(name: string, search: string = "") {
	const pageName = strToPageName(name);
	if (pageName == null || (loader.loaded && loader.loaded === pageName && location.search === search)) {
		return;
	}
	history.pushState(null, "", "/" + pageName + search);
	await loadPage();
}


(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
		loadPage();
}