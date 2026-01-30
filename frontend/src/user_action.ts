import { api, Status } from "./api.js";
import { gotoPage, gotoUserPage } from "./PageLoader.js";
import { notify } from "./utils/notifs.js";

export function initSearchBar(userAction: HTMLElement, onCardClick: (card: HTMLElement) => void = loadProfile) {
	const search = userAction.querySelector<HTMLInputElement>("#user-search");
	const result = userAction.querySelector<HTMLElement>("#user-results");

	if (!search || !result) {
		return;
	}
	search.addEventListener("input", async () => {
		const searchName = search.value.trim().toLowerCase();

		if (searchName.length == 0) {
			result.innerHTML = "";
			return;
		}

		const allUsers = await api.get("/api/user/all");

		if (!allUsers || !allUsers.payload || !allUsers.payload.users) {
			result.innerHTML = "<div>Pas d'utilisateurs chargés</div>";
			return;
		}

		const selectedUsers = allUsers.payload.users.filter((user: any) => {
			return user.displayName.toLowerCase().includes(searchName);
		});

		displayResultSearch(userAction, selectedUsers, onCardClick);
	});

	search.addEventListener("focusout", () => {
		setTimeout(() => {
			search.value = "";
			const results = userAction.querySelector<HTMLElement>("#user-results");

			if (results) results.innerText = "";
		}, 100);
	});
}

function displayResultSearch(userAction: HTMLElement, selectedUsers: any, onCardClick: (card: HTMLElement) => void) {
	const results = userAction.querySelector<HTMLElement>("#user-results");
	if (!results) {
		return;
	}

	results.innerHTML = "";

	selectedUsers.forEach(async (user: any) => {
		const displayName = user.displayName;
		const blocked = await api.post("/api/friend/blockedme", { displayName });
		if (blocked?.payload.blocked === true) {
			return;
		}

		const card = document.createElement("div");
		card.className = "user-result";

		const avatar = document.createElement("img");
		avatar.src = user.avatar.startsWith("/") ? user.avatar : `/${user.avatar}`;
		avatar.className = "result-avatar";

		const name = document.createElement("span");
		name.textContent = user.displayName;
		name.className = "result-name";

		card.appendChild(avatar);
		card.appendChild(name);

		card.onclick = () => onCardClick(card);

		results.appendChild(card);
	});
}

async function loadProfile(card: HTMLElement): Promise<void> {
	const me = await api.get("/api/user/me");
	if (!me || !me.payload) {
		return;
	}
	if (me.status != Status.success) {
		return notify("Error: " + me.payload.message, "error");
	}
	const displayName = card.querySelector<HTMLElement>("span")?.innerText || "";
	if (me.payload.displayName == displayName) {
		await gotoPage("profile");
	} else {
		await gotoUserPage(displayName);
	}
}
