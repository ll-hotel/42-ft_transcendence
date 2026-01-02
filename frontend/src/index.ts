import { api } from "./api.js";
import { gotoPage, strToPageName } from "./PageLoader.js";
import socket from "./socket.js";

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		alert("Missing content div");
		return;
	}
	const uri = window.location.pathname;

	const res = await api.get("/api/me");
	if (res && res.status == 200) {
		socket.connect();
	}
	
	const name = strToPageName(uri.substring(1)) || "login";
	await gotoPage(name);
});
