import { GameChat } from "./GameChat.js";
import PageLoader, { strToPageName } from "./PageLoader.js";

var app: {
	menu: HTMLElement,
	content: HTMLElement,
	loader: PageLoader,
	chat: GameChat,
};

document.addEventListener("DOMContentLoaded", async function() {
	const menu = document.getElementById("dynamic-menu");
	const content = document.getElementById("content");
	if (menu === null || content === null) {
		alert("Missing required HTML elements");
		return;
	}
	const pageLoader = new PageLoader(content);
	await pageLoader.downloadPages();
	app = {
        menu,
		content,
		loader: pageLoader,
		chat: new GameChat(),
	};
	app.chat.loadInto(app.content);
	for (let key of pageLoader.list.keys()) {
		console.log(key);
		const li = document.createElement("li");
		li.innerHTML = `<a href="#${key}">${key}</a>`;
		menu.appendChild(li);
	}
	window.addEventListener("hashchange", function() {
		const hash = window.location.hash.replace("#", "");
		const name = strToPageName(hash)
		if (name) pageLoader.load(name);
	});
	window.location.replace("#home");
});
