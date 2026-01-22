import { api, Status } from "./api.js";
import { gotoPage, gotoUserPage, strToPageName } from "./PageLoader.js";
import socket from "./socket.js";
import { notify } from "./utils/notifs.js";
import { initSocket } from "./socketListener.js";
import { initStarfield } from "./utils/background.js";


initStarfield();

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		notify("Missing content div", "error");
		return;
	}
	
	initSocket();
	initSearchBar();
	const uri = window.location.pathname;

	// JAI ENLEVER LES HISTORIQUE ICI

	const name = strToPageName(uri.substring(1)) || "login";
	if (name == "login" || (await socket.connect()) == false) {
		await gotoPage("login", location.search);
	} else if (name == "profile/other" || name == "tournament") {
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


function initSearchBar() {
	const search = document.getElementById("user-search") as HTMLInputElement | null;
	const result = document.getElementById("user-results");

	if (!search || !result) {
		return;
	}

	search.addEventListener("input", async () => {
		const searchName = search.value.trim().toLowerCase();

		if (searchName.length == 0) {
			result.innerHTML = "";
			return;
		}

		const allUsers = await api.get("/api/users/all");

		if (!allUsers || !allUsers.payload || !allUsers.payload.users) {
			result.innerHTML = "<div>Pas d'utilisateurs chargés</div>";
			return;
		}

		const selectedUsers = allUsers.payload.users.filter((user: any) => {
			return user.displayName.toLowerCase().includes(searchName);
		});

		displayResultSearch(selectedUsers);
	});
}

function displayResultSearch(selectedUsers: any) {
	const results = document.getElementById("user-results");
	if (!results) {
		return;
	}

	results.innerHTML = "";

	selectedUsers.forEach((user: any) => {
		const card = document.createElement("div");
		card.className = "user-result";

		const avatar = document.createElement("img");
		avatar.src =  user.avatar.startsWith("/") ? user.avatar : `/${user.avatar}`;
		avatar.className = "result-avatar";

		const name = document.createElement("span");
		name.textContent = user.displayName;
		name.className = "result-name";

		card.appendChild(avatar);
		card.appendChild(name);

		card.onclick = async () => {
			const me = await api.get("/api/me");
			if (!me || !me.payload)
				return;
			if (me.status != Status.success)
				return notify("Error: " + me.payload.message, "error");
			if (me.payload.displayName == user.displayName)
				await gotoPage("profile");
			else
				await gotoUserPage(user.displayName);
		}

		results.appendChild(card);

	}
	)
}
