import { gotoPage, strToPageName } from "./PageLoader.js";
// import { Chat } from "./TextChat.js";

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		alert("Missing content div");
		return;
	}
	// (window as any).chat = Chat.new("/api/chat/connect");
	const uri = window.location.pathname;
	const name = strToPageName(uri.substring(1)) || "login";
	await gotoPage(name);
});
