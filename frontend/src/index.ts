import PageLoader, { strToPageName } from "./PageLoader.js";

var app: {
	dynamicMenu: HTMLElement,
	content: HTMLElement,
	pageLoader: PageLoader,
};

document.addEventListener("DOMContentLoaded", async function() {
	const dynamicMenu = document.getElementById("dynamic-menu");
	const content = document.getElementById("content");
	if (dynamicMenu === null || content === null) {
		alert("Missing required HTML elements");
		return;
	}
	const pageLoader = new PageLoader(content);
	await pageLoader.downloadPages();
	app = {
        dynamicMenu,
		content,
		pageLoader,
	};
	for (let key of pageLoader.list.keys()) {
		console.log(key);
		const li = document.createElement("li");
		li.innerHTML = `<a href="#${key}">${key}</a>`;
		dynamicMenu.appendChild(li);
	}
	window.addEventListener("hashchange", function() {
		const hash = window.location.hash.replace("#", "");
		const name = strToPageName(hash)
		if (name) pageLoader.load(name);
	});
	window.location.replace("#home");
});
