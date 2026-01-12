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
	const name = strToPageName(uri.substring(1)) || "login";
	if (name == "login" || (await socket.connect()) == false) {
		await gotoPage("login", location.search);
	} else {
		const me = await api.get("/api/me");
		if (me && me.payload.tournamentName) {
			await gotoPage("play/tournament", "?name=" + me.payload.tournamentName);
		} else {
			await gotoPage(name);
		}
	}
});
