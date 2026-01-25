/*TO DO
GROSSE TACHES
x Creer un moyen d'ajouter des amis (navbar pour trouver un user (si la chose rentrer correspond au Displayname alors redirige vers le profil du mec))
x Gerer la reception d'une demande d'ami (notif qui redirige vers son profil ? Message du type (Antoine sohaite etre amie avec vous) ?)
X Gestion de l'affichage des chats (api via l'id qui retourne les precedents messages envoyés (api/message/iddupoteaquitenvoielesmessages))

PETITES TACHES
° Gerer mieux le responsive (card friend, container friend and mess)
X Rendre visible l'ami séléctionner
° link les bouttons Block, 1vs1 
X Link l'input text, et le button send

*/
import AppPage from "./AppPage.js";
import { api, Status } from "../api.js";
import { gotoPage, gotoUserPage } from "../PageLoader.js";
import { FriendChat } from "./FriendChat.js";
import { notify } from "../utils/notifs.js";
import socket from "../socket.js";

type Message = {
	source: string;
	target: string;
	content: string 
};


export class FriendPage implements AppPage
{
	content: HTMLElement;
	listContainer: HTMLElement;
	chatContainer: HTMLElement;
	selectedCard: HTMLElement | null;
	renderInterval: number | null = null;
	chat: FriendChat;

	constructor(content: HTMLElement)
	{
		this.content= content;
		this.listContainer = content.querySelector("#friend-list-content")!;
		this.chatContainer = content.querySelector("#friend-chat")!;
		this.selectedCard = null;
		this.chat = new FriendChat();
		if (!this.listContainer || !this.chatContainer)
					console.log("Error in html");
	}

	static new(content:HTMLElement)
	{
		if (!content || !content.querySelector("#friend-list-content") || !content.querySelector("#friend-chat"))
		{
			console.log("Missing Friend list or Friend chat in html");
			return null;
		}
		return new FriendPage(content);
	}

	async loadInto(container: HTMLElement)
	{
		container.appendChild(this.content);
		await this.chat.connect(`/api/chat/connect`);
		await this.loadFriends();
	}

	unload(): void
	{
		if (this.renderInterval)
		{
			clearInterval(this.renderInterval);
			this.renderInterval = null;
		}
		this.chat.reset();
		this.selectedCard = null;
		this.content.remove();
		const chatList = this.chatContainer.querySelector<HTMLDivElement>("#chat-content");
		const chatName = this.chatContainer.querySelector<HTMLSpanElement>("#chat-name");
		const blockBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-block");
		const vsBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-1vs1");
		if (!chatList || !chatName || !blockBtn || !vsBtn)
			return;
		chatList.innerHTML= "";
		chatName.textContent = chatName.dataset.default!;
		chatName.classList.remove("hover:text-[#04809F]");
		chatName.classList.remove("cursor-pointer");
		chatName.onclick = null;

		blockBtn.disabled = true;
		vsBtn.disabled = true;
	}


	async loadFriends() 
	{
		this.listContainer.innerHTML = "<div>Finding friends...</div>";

		const friendRes = await api.get("/api/friends");
		const requestRes = await api.get("/api/friend/requests")

		if (!friendRes || !requestRes || friendRes.status !== Status.success || requestRes?.status !== Status.success ) {
			this.listContainer.innerHTML = "<div>Error while charging...</div>";
			return;
		}

		const friends = friendRes.payload.friends
		const requests = requestRes.payload.requests
		this.listContainer.innerHTML = "";

		if ((!friends || friends.length === 0) && (!requests || requests.length === 0))
		{
			this.listContainer.innerHTML = `<div class="no-friend" >Go get some friends dude :)</div>`;
			return;
		}

		requests.forEach((request: any) => {
			const card:HTMLElement = this.createRequestCard(request)
			this.listContainer.appendChild(card);
		}
	)

		friends.forEach((friend: any) => {
			const card :HTMLElement = FriendPage.createFriendCard(friend);
			card.onclick = async () => {

				if(this.selectedCard)
				{
					this.selectedCard.classList.remove("friend-card-select");
					this.selectedCard.classList.add("friend-card-unselect");
				}

				card.classList.remove("friend-card-unselect");
				card.classList.add("friend-card-select");

				this.selectedCard = card;
				this.loadChat(friend.displayName, friend.username, friend.uuid);
			}
			this.listContainer.appendChild(card);
		});
	}

	// GESTION CARTES FRIENDS

	static createFriendCard(friend: any): HTMLElement
	{
		const card = document.createElement("div");
		card.className = "friend-card";

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
				notify(`You are now friend with ${request.requestFrom}`, "success");
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
				console.log(`Tu n'es pas ami avec ${request.requestFrom}`);
				notify(`You declined friend request from ${request.requestFrom}`, "info");
				card.remove();
			}
			else
				console.error("declineRes didn't work");
		}

		requestsBtn?.appendChild(accept);
		requestsBtn?.appendChild(decline);
	return card;
	}

	//Gestion Chargement du chat

	async loadChat(targetDisplayname : string, targetUsername: string, targetUuid : string)
	{
		if (targetUsername == this.chat.targetUsername)
			return;
		
		const chatName = this.chatContainer.querySelector<HTMLSpanElement>("#chat-name")!;
		const chatList = this.chatContainer.querySelector<HTMLDivElement>("#chat-content")!;
		
		if (!chatName || !chatList)
		{
			console.log("Missing chatName or chatList in html");
			return;
		}

		chatList.innerHTML= "";
		this.chat.cleanRoomState();
		await this.chat.openRoom(targetUsername);
		await this.chat.loadHistory();
		
		chatName.textContent = targetDisplayname;
		chatName.classList.add("hover:text-[#04809F]");
		chatName.classList.add("cursor-pointer");
		chatName.onclick = async () => { 
			await gotoUserPage(targetDisplayname);
		}
		await this.setBlockButton(chatName, chatList, targetDisplayname);
		await this.setVsButton(targetDisplayname, targetUuid);
		this.renderMessages(chatList);
		this.bindSend();
		
		if (this.renderInterval)
			clearInterval(this.renderInterval);

	this.renderInterval = window.setInterval(() => {
	this.renderMessages(chatList);
	}, 	300);
	}

	async setBlockButton(chatName : HTMLSpanElement, chatList : HTMLDivElement, targetDisplayname : string) {
		const blockBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-block")!;

		blockBtn.disabled = !this.selectedCard;
		blockBtn.onclick = async () => {
			const confirmBlock = confirm(`Do you want to remove ${targetDisplayname} from friend's list?`);
			if (!confirmBlock)
				return;

			const res = await api.delete("/api/friend/remove", { displayName: targetDisplayname });
			if (res && res.status === Status.success) {
				notify(`${targetDisplayname} isn't your friend anymore.`, "info");

				await this.loadFriends();

				chatList.innerHTML = "";
				chatName.textContent = chatName.dataset.default!;
				chatName.classList.remove("hover:text-[#04809F]");
				chatName.classList.remove("cursor-pointer");
				chatName.onclick = null;
				this.selectedCard = null;
				this.chat.cleanRoomState();
				blockBtn.disabled = true;
			}
			else {
				notify("Error while deleting this friend.", "error");
			}
		};
	}

	setVsButton(targetDisplayname : string, targetUuid : string)
	{
		const vsBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-1vs1")!;

		vsBtn.disabled = !this.selectedCard;
		vsBtn.onclick = async () =>{
			const confirmVs = confirm(`Do you want to play with ${targetDisplayname} ?`)
			if (!confirmVs)
				return;

			const me = await api.get("api/me");
			if (!me || !me.payload)
				return;
			if (me.status !== Status.success)
				return notify("Error when getting user info: " + me.payload.message, "error");
			socket.send({
				source: me.payload.uuid,
				topic: "vs:invite",
				target : targetUuid,
			});
		}
	}


	bindSend()
	{
		const form = this.chatContainer.querySelector<HTMLFormElement>("#chat-footer");
		const input = this.chatContainer.querySelector<HTMLInputElement>("#chat-input");

		if (!form || !input)
		{
			console.log("Missing chat input or form in html");
			return;
		}
		form.onsubmit = (e) => {
			e.preventDefault()
			if (!input.value || !this.chat.currentRoomId )
				return ;
			this.chat.send(input.value);
			input.value = "";
		};
	}

	renderMessages(chatList: HTMLDivElement) {
		const msgs = this.chat.getRoomMessages();

		const newMsgs = msgs.slice(this.chat.lastMessage); 

		if (!newMsgs.length)
			return;

		for (let msg of newMsgs)
		{
			const divMsg = document.createElement("div");
			msg.source === `@${this.chat.username}` ? 
				divMsg.classList.add("msg-me") : divMsg.classList.add("msg-target") ;
			divMsg.textContent = msg.content;
			chatList.appendChild(divMsg);
		}
		this.chat.lastMessage = msgs.length
		chatList.scrollTop = chatList.scrollHeight;
	}

}