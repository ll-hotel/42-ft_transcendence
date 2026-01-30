import { gotoPage, strToPageName } from "./PageLoader.js";
import socket from "./socket.js";
import { initSocket } from "./socketListener.js";
import { initSearchBar } from "./user_action.js";
import { initStarfield } from "./utils/background.js";
import { notify } from "./utils/notifs.js";

initStarfield();

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		notify("Missing content div", "error");
		return;
	}

	initSocket();

	const searchBar = document.querySelector<HTMLElement>("#user-action");
	if (searchBar) {
		initSearchBar(searchBar);
	}

	const uri = window.location.pathname;

	const name = strToPageName(uri.substring(1)) || "login";
	if (name === "login" || (await socket.connect()) === false) {
		await gotoPage("login", location.search);
	} else if (name === "profile/other" || name === "tournament" || name === "play/match") {
		await gotoPage(name, location.search);
	} else {
		await gotoPage(name);
	}

	const headerButtons = document.querySelectorAll("header button");

	headerButtons.forEach(btn => {
		btn.addEventListener("click", async () => {
			const page = strToPageName(btn.getAttribute("data-page")!);
			if (!page) {
				return;
			}
			await gotoPage(page);
			headerButtons.forEach(b => b.classList.remove("font-bold"));
			btn.classList.add("font-bold");
		});
	});
});
