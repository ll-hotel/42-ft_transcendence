/*TO DO
GROSSE TACHES
° Creer un moyen d'ajouter des amis (navbar pour trouver un user (si la chose rentrer correspond au Displayname alors redirige vers le profil du mec))
° Gerer la reception d'une demande d'ami (notif qui redirige vers son profil ? Message du type (Antoine sohaite etre amie avec vous) ?)
° Gestion de l'affichage des chats (api via l'id qui retourne les precedents messages envoyés (api/message/iddupoteaquitenvoielesmessages))

PETITES TACHES
° Gerer mieux le responsive (card friend, container friend and mess)
° Rendre visible l'ami séléctionner
° link les bouttons Block, 1vs1 
° Link l'input text, et le button send

*/
import AppPage from "./AppPage.js";
import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";

type Friend = {
	displayName: string,
	avatar: string,
	isOnline: number,
};

export class FriendPage implements AppPage {
	content: HTMLElement;
	listContainer: HTMLElement;
	chatContainer: HTMLElement;

	constructor(content: HTMLElement)
	{
		this.content= content;
		this.listContainer = content.querySelector("#friend-list-content")!;
		this.chatContainer = content.querySelector("#friend-chat")!;

		if (!this.listContainer || !this.chatContainer)
				throw new Error("Friend page HTML incorrect");
	}

	static new(content:HTMLElement) {
		if (!content)
			return null;

		const list = content.querySelector("#friend-list-content")!;
		const chat = content.querySelector("#friend-chat")!;

		if (!list || !chat)
			return null;

		return new FriendPage(content);
	}

	async loadInto(container: HTMLElement)
	{
		const token = localStorage.getItem("accessToken");
		if (!token) {
			return gotoPage("login");
		}
		container.appendChild(this.content);
		return this.loadFriends();
	}

	unload(): void {
		this.content.remove();
	}


	async loadFriends(){
		this.listContainer.innerHTML = "<div>En recherche d'amis</div>";

		const res = await api.get("/api/friends");
		console.log("API Response:", res);

		if (!res || res.status !== Status.success) {
			this.listContainer.innerHTML = "<div>Erreur lors de la recherche</div>";
			return;
		}

		const friends = res.payload
		this.listContainer.innerHTML = "";

		const card = document.createElement("div");
		card.className = "friend-card";

		card.innerHTML = `
			<img class="friend-avatar" src="/default_pp.png" alt="Antoine" />
			<div class="text-m font-semibold">
				Antoine
			</div>
			<div class="friend-status">
				<div class="friend-round-online">
				</div>
				<span class="friend-text-online">
					Online
				</span>
			</div>
		`;
		this.listContainer.appendChild(card);
		
		if(!friends.value)
			console.log("No Friend"); //Afficher une div qui dit que t'as pas de potes

		friends.forEach((friend: any) => {
			const card = FriendPage.createFriendCard(friend)
			card.onclick = () => this.loadChat(friend.id);
			this.listContainer.appendChild(card);
		});
	}

	async loadChat(friendId : number) {
		this.chatContainer.innerHTML = "<div>Besoin de creer le chat...</div>"
		return;
	}

		static createFriendCard(friend: any): HTMLElement {
	const card = document.createElement("div");
	card.className = "friend-card";

	card.innerHTML = `
		<img src="${friend.avatar}" alt="${friend.displayName}" class="friend-card">
		<div class="friend-avatar">
			${friend.displayName}
		</div>
		<div class="friend-status">
			<div class="${friend.isOnline ? "friend-status-online" : "friend-status-offline"}">
			</div>
			<span class="${friend.isOnline ? "friend-round-online" : "friend-round-offline"}">
				${friend.isOnline ? "Online" : "Offline"}
			</span>
		</div>
	`;

	return card;
}
}