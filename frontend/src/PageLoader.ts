import AppPage from "./pages/AppPage.js";
import newHomePage from "./pages/HomePage.js";
import { FriendPage } from "./pages/FriendPage.js";
import { Login } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";
import { ProfilePage } from "./pages/profile.js"
import { OtherProfilePage } from "./pages/otherProfile.js";
import { ChatElement } from "./pages/chat.js";
import { editProfile } from "./pages/editProfile.js";

enum Pages {
	home = "home.html",
	register = "register.html",
	login = "login.html",
	profile = "profile.html",
	editProfile = "editProfile.html",
	otherProfile="otherProfile.html",
	friend ="friend.html",
};
export type PageName = keyof typeof Pages;

export function strToPageName(str: string): PageName | null {
	switch (str) {
		case "home": return "home";
		case "register": return "register";
		case "login": return "login";
		case "profile": return "profile";
		case "otherProfile" : return "otherProfile";
		case "friend": return "friend";
		case "editProfile": return "editProfile";
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
			this.download("otherProfile"),
			this.download("friend"),
			this.download("editProfile"),
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
		let newPage: (html: HTMLElement) => AppPage | null;
		switch (name) {
			case "home": newPage = newHomePage; break;
			case "register": newPage = RegisterPage.new; break;
			case "login": newPage = Login.new; break;
			case "profile": newPage = ProfilePage.new; break;
			case "otherProfile": newPage = OtherProfilePage.new; break;
			case "friend": newPage = FriendPage.new; break;
			case "editProfile": newPage = editProfile.new; break;
		}
		const html = await downloadHtml(Pages[name]);
		const page = newPage(html);
		if (page === null) {
			return alert("Could not load " + Pages[name]);
		}
		this.list.set(name, page);
	}
};

async function downloadHtml(path: string, cache: RequestCache = "default"): Promise<HTMLElement> {
	const element = await fetch(`/${encodeURI(path)}`, {
		method: "GET",
		headers: { "Accept": "text/html" },
		credentials: "include",
		cache,
	}).then(res => res.text().then(text => (new DOMParser).parseFromString(text, "text/html").body.firstElementChild));

	if (!element)
		throw new Error(`No elements fond at ${path}`);
	return element as HTMLElement;
	
}

export async function gotoUserPage( displayName : any)
{
	history.pushState({ page: "otherProfile", params : {displayName}}, "", "/user/" + displayName);
	await gotoPage("otherProfile", {displayName});
}
const loader = new PageLoader(document.body.querySelector("#content")!);

export async function gotoPage(name: PageName, params?: any) {
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
}


(window as any).gotoPage = gotoPage;

window.onpopstate = function() {
	const path = location.pathname.substring(1);
	if (path.startsWith("user/"))
		{
			const displayName = path.split("/")[1];
			gotoPage("otherProfile", {displayName});
			return;
		}
		const page = strToPageName(path) || "login";
		gotoPage(page);
	}