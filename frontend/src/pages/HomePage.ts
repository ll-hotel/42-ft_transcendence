import { api, Status } from "../api.js";
import { gotoPage, gotoUserPage } from "../PageLoader.js";
import socket from "../socket.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js";

export class HomePage implements AppPage {
	html: HTMLElement;
	listContainer : HTMLElement;
	inQueue : boolean;

	constructor(html: HTMLElement) {
		this.html = html;
		this.inQueue = false;
		this.listContainer = html.querySelector("#friend-list-content")!;
	}

	static async new(html: HTMLElement): Promise<AppPage> {
		return new HomePage(html);
	}

	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
		this.loadHome();
	}

	unload(): void {
		this.html.remove();
	}

	async loadHome() {
		const buttonLocalVs = this.html.querySelector<HTMLDivElement>("#local-vs");
		const buttonOnlineVs = this.html.querySelector<HTMLDivElement>("#online-vs");
		const buttonFindTournament = this.html.querySelector<HTMLDivElement>("#find");
		const buttonCreateTournament = this.html.querySelector<HTMLDivElement>("#create");

		if (!buttonLocalVs  || !buttonOnlineVs || !buttonFindTournament || !buttonCreateTournament)
		{
			console.log("Missing some buttons in html");
			return;
		}

/*		buttonOnlineVs.onclick = () => {
				api.get("/api/match/current").then((res) => {
					if (!res)
						return;
					if (res.status == Status.not_found)
					{
						gotoPage("matchmaking");
					}
					else if (res.status == Status.success)
						gotoPage("pong", "?matchId=" + res.payload.id);
					else
						notify("Error " + res.status, "error");
				});
		}*/

		buttonLocalVs.onclick = () => {
			gotoPage("play/local");
		}

		buttonOnlineVs.onclick =  () => {
			api.get("/api/match/current").then((res) => {
				if (!res)
					return;
				if (res.status == Status.not_found)
				{
					this.playRandom();
				}
				else if (res.status == Status.success)
					gotoPage("play/match", "?id=" + res.payload.id);
				else
					notify("Error " + res.status, "error");
				});
		}

		const gotoTournaments = () => gotoPage("tournaments");
		buttonFindTournament.onclick = gotoTournaments;
		buttonCreateTournament.onclick = gotoTournaments;

		await this.loadFriends();
	}

	async playRandom() {
		socket.addListener("matchmaking:found", (message) => {
					socket.removeListener("matchmaking:found");
					this.inQueue = false;
		
					const matchMsg = message as { match: number, opponent: string };
					notify("Match found! Playing against " + matchMsg.opponent, "success");
					setTimeout( () => {
						gotoPage("play/match", `?id=${matchMsg.match}`);
					}, 3000);
				})
				const join = await api.post("/api/matchmaking/join");
				if (!join || join.status != Status.success) {
					notify(join ? join.payload.message : "Can not join queue.", "error");
				} else {
					this.inQueue = true;
					notify(join.payload.message, "success");
				}
	}

	async loadFriends() {
		this.listContainer.innerHTML = "<div>Searching friends...</div>";
		const friendRes = await api.get("/api/friends");
		const requestRes = await api.get("/api/friend/requests");

		if (!friendRes || !requestRes || friendRes.status !== Status.success || requestRes?.status !== Status.success) {
			this.listContainer.innerHTML = "<div>Error while searching...</div>";
			return;
		}

		const friends = friendRes.payload.friends;
		const requests = requestRes.payload.requests;
		this.listContainer.innerHTML = "";

		if ((!friends || friends.length == 0) && (!requests || requests.length === 0)) {
			this.listContainer.innerHTML = `<div class="no-friend" >Go get some friends dude :)</div>`;
			return;
		}

		requests.forEach((request: any) => {
			const card: HTMLElement = this.createRequestCard(request);
			this.listContainer.appendChild(card);
		});

		friends.forEach((friend: any) => {
			const card: HTMLElement = this.createFriendCard(friend);
			card.onclick = async () => gotoUserPage(friend.displayName);
			this.listContainer.appendChild(card);
		});
	}

	createFriendCard(friend: any): HTMLElement
	{
		const card = document.createElement("div");
		card.className = "friend-card";
		card.classList.add("friend-card-home");

		card.innerHTML = `
			<img src="${friend.avatar}" alt="${friend.displayName}" class="friend-avatar">
				<div class="text-m font-semibold">
					${friend.displayName}
				</div>
				<div class="friend-status">
					<div class="${friend.isOnline ? "friend-round-online" : "friend-round-offline"}">
				</div>
				<span class="${friend.isOnline ? "friend-text-online" : "friend-text-offline"}">
					${friend.isOnline ? "Online" : "Offline"}
				</span>
			</div>
		`;

		return card;
	}

	createRequestCard(request: any): HTMLElement {
		const card = document.createElement("div");
		card.className = "request-card";

		card.innerHTML = `
			<img src="${request.avatar}" alt="${request.requestFrom}" class="friend-avatar">
				<div class="text-m font-semibold">
					${request.requestFrom}
				</div>
				<div class="request-buttons">
				</div>
			`;

		const requestsBtn = card.querySelector(".request-buttons");

		const accept = document.createElement("button");
		accept.className = "request-accept";
		accept.textContent = "Yes";

		accept.onclick = async () => {
			const res = await api.patch("/api/friend/accept", { displayName: request.requestFrom });
			if (res == null) {
				return;
			}
			if (res.status != Status.success) {
				return notify(res.payload.message || "Accept failed", "error");
			}
			notify(`You are now friend with ${request.requestFrom}`, "success");
			card.remove();
			this.loadFriends();
		};

		const decline = document.createElement("button");
		decline.className = "request-decline";
		decline.textContent = "No";

		decline.onclick = async () => {
			const res = await api.patch("/api/friend/decline", { displayName: request.requestFrom });
			if (!res) {
				return;
			}
			if (res.status != Status.success) {
				return notify(res.payload.message, "error");
			}
			notify(`Declined friend request from ${request.requestFrom}`, "success");
			card.remove();
		};

		requestsBtn?.appendChild(accept);
		requestsBtn?.appendChild(decline);
		return card;
	}
}
