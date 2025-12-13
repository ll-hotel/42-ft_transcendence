import { gotoPage, strToPageName } from "./PageLoader.js";

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		alert("Missing content div");
		return;
	}
	const uri = window.location.pathname;
	const name = strToPageName(uri.substring(1)) || "login";
	await gotoPage(name);
});
