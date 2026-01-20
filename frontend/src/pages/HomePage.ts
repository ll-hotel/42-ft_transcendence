import AppPage from "./AppPage.js";
import { api, Status } from "../api.js";
import { gotoPage, gotoUserPage } from "../PageLoader.js";


export class HomePage implements AppPage {
	html: HTMLElement;
	listContainer : HTMLElement;

	constructor(html: HTMLElement) {
		this.html = html;
		this.listContainer = html.querySelector("#friend-list-content")!;
	}

	static new(content:HTMLElement)
	{
		if (!content)
			return null;
		return new HomePage(content);
	}

	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
		this.loadHome();
	}


	unload(): void {
		this.html.remove();
	}

	async loadHome()
	{
		const buttonLocalVs = this.html.querySelector<HTMLDivElement>("#local-vs");
		const buttonLocalIa = this.html.querySelector<HTMLDivElement>("#local-ia");
		const buttonOnlineVs = this.html.querySelector<HTMLDivElement>("#online-vs");
		const buttonFindTournament = this.html.querySelector<HTMLDivElement>("#find");
		const buttonCreateTournament = this.html.querySelector<HTMLDivElement>("#create");

		if (!buttonLocalVs || !buttonLocalIa || !buttonOnlineVs || !buttonFindTournament || !buttonCreateTournament)
		{
			console.log("Missing somme buttons in html");
			return;
		}

		buttonLocalVs.onclick = buttonLocalIa.onclick = buttonOnlineVs.onclick = () => {
			gotoPage("match");
		}

		buttonFindTournament.onclick = buttonCreateTournament.onclick = () => {
			gotoPage("tournament");
		}

		await this.loadFriends();
	}

	async loadFriends() {
		this.listContainer.innerHTML = "<div>Searching friends...</div>";
		const friendRes = await api.get("/api/friend");
		const requestRes = await api.get("/api/friend/requests")

		if (!friendRes || !requestRes || friendRes.status !== Status.success || requestRes?.status !== Status.success ) {
			this.listContainer.innerHTML = "<div>Error while searching...</div>";
			return;
		}

		const friends = friendRes.payload.friends
		const requests = requestRes.payload.requests
		this.listContainer.innerHTML = "";

		if ((!friends || friends.length == 0) && (!requests || requests.length === 0))
		{
			this.listContainer.innerHTML = `<div class="no-friend" >Go get some friends dude :)</div>`;
			return;
		}
		
		requests.forEach((request: any) => {
			const card:HTMLElement = this.createRequestCard(request)
			this.listContainer.appendChild(card);
		});

		friends.forEach((friend: any) => {
			const card :HTMLElement = this.createFriendCard(friend);
			card.onclick = async () =>
				gotoUserPage(friend.displayName);
			this.listContainer.appendChild(card);
		});
	}
	
	createFriendCard(friend: any): HTMLElement
	{
		const card = document.createElement("div");
		card.className = "friend-card";
		card.classList.add("friend-card-home")

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


	createRequestCard(request: any): HTMLElement
	{
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

		const requestsBtn = card.querySelector(".request-buttons")

		const accept = document.createElement("button")
		accept.className = "request-accept";
		accept.textContent = "Yes";

		accept.onclick = async () => {
			const acceptRes = await api.patch("/api/friend/accept", {displayName : request.requestFrom});

			if (acceptRes && acceptRes.status == Status.success)
			{
				console.log(`Tu es ami avec ${request.requestFrom}`);
				card.remove();
				this.loadFriends();
			}
			else
				console.error("AcceptRes didn't work");
		}

		const decline = document.createElement("button")
		decline.className = "request-decline";
		decline.textContent = "No";

		decline.onclick = async () => {
			const declineRes = await api.patch("/api/friend/decline", {displayName : request.requestFrom});

			if (declineRes && declineRes.status == Status.success)
			{
				console.log(`YOu're not friend with ${request.requestFrom}`);
				card.remove();
			}
			else
				console.error("declineRes didn't work");
		}

		requestsBtn?.appendChild(accept);
		requestsBtn?.appendChild(decline);
	return card;
	}
}
