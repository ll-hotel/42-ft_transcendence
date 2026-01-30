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
import { api, Status } from "../api.js";
import { gotoUserPage } from "../PageLoader.js";
import socket from "../socket.js";
import { initSearchBar } from "../user_action.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js";
import { FriendChat } from "./FriendChat.js";

export class FriendPage implements AppPage {
	content: HTMLElement;
	listContainer: HTMLElement;
	chatContainer: HTMLElement;
	selectedCard: HTMLElement | null;
	renderInterval: number | null = null;
	chat: FriendChat;
	searchBar: HTMLElement;
	cardsDisplayNames: string[] = [];

	constructor(content: HTMLElement, searchBar: HTMLElement) {
		this.content = content;
		this.listContainer = content.querySelector("#friend-list-content")!;
		this.chatContainer = content.querySelector("#friend-chat")!;
		initSearchBar(searchBar, (card) => this.userSelected(card));
		this.searchBar = searchBar;
		this.selectedCard = null;
		this.chat = new FriendChat();
		if (!this.listContainer || !this.chatContainer) {
			console.log("Error in html");
		}
	}

	static async new(content: HTMLElement): Promise<AppPage | null> {
		if (!content || !content.querySelector("#friend-list-content") || !content.querySelector("#friend-chat")) {
			console.log("Missing Friend list or Friend chat in html");
			return null;
		}
		const searchBar = content.querySelector<HTMLElement>("#search-user-action");
		if (!searchBar) {
			console.log("friend page: missing search bar");
			return null;
		}
		return new FriendPage(content, searchBar);
	}

	async userSelected(card: HTMLElement): Promise<void> {
		const userDisplayName = card.querySelector<HTMLElement>("span")?.innerText || "";
		this.loadChat(userDisplayName);
	}

	async loadInto(container: HTMLElement) {
		this.bindSend();
		container.appendChild(this.content);
		await this.chat.connect();
		await this.loadRooms();
	}

	unload(): void {
		this.cardsDisplayNames = [];
		if (this.renderInterval) {
			clearInterval(this.renderInterval);
			this.renderInterval = null;
		}
		this.chat.reset();
		this.selectedCard = null;
		this.content.remove();
		const chatList = this.chatContainer.querySelector<HTMLDivElement>("#chat-content");
		const chatName = this.chatContainer.querySelector<HTMLSpanElement>("#chat-name");
		const blockBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-block");
		// const removeBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-remove-friend");
		const vsBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-1vs1");
		if (!chatList || !chatName || !blockBtn || !vsBtn) {
			return;
		}
		chatList.innerHTML = "";
		chatName.textContent = chatName.dataset.default!;
		chatName.classList.remove("hover:text-[#04809F]");
		chatName.classList.remove("cursor-pointer");
		chatName.onclick = null;

		blockBtn.disabled = true;
		vsBtn.disabled = true;
	}

	async loadRooms() {
		this.listContainer.innerHTML = "";

		const requestRes = await api.get("/api/friend/requests");
		if (requestRes) {
			const requests = requestRes.payload.requests as any[];
			requests.forEach((request: any) => {
				const card: HTMLElement = this.createRequestCard(request);
				this.listContainer.appendChild(card);
			});
		}

		this.cardsDisplayNames = [];

		const friendRes = await api.get("/api/friend");
		if (friendRes) {
			const friends = friendRes.payload.friends as any[];
			friends.forEach((friend) => {
				const card: HTMLElement = FriendPage.createFriendCard(
					friend.displayName,
					friend.avatar,
					friend.isOnline,
				);
				card.onclick = () => {
					this.switchRoomCard(card);
					this.loadChat(friend.displayName);
				};
				this.cardsDisplayNames.push(friend.displayName);
				this.listContainer.appendChild(card);
			});
		}

		const roomsRes = await api.get("/api/chat/rooms");
		if (roomsRes) {
			if (roomsRes.status != Status.success) {
				notify(roomsRes.payload.message, "error");
				return;
			}
			const rooms = roomsRes.payload.rooms as string[];
			rooms.forEach(async (username) => {
				const userRes = await api.get("/api/user?username=" + username);
				if (!userRes) return;
				if (userRes.status != Status.success) return;
				const { displayName, avatar, isOnline } = userRes.payload.user as {
					displayName: string,
					avatar: string,
					isOnline: boolean,
				};
				const card = FriendPage.createFriendCard(displayName, avatar, isOnline);
				card.onclick = () => {
					this.switchRoomCard(card);
					this.loadChat(displayName);
				};
				if (this.cardsDisplayNames.find((value) => value == displayName) == undefined) {
					this.cardsDisplayNames.push(displayName);
					this.listContainer.appendChild(card);
				}
			});
		}
	}

	switchRoomCard(card: HTMLElement): void {
		if (this.selectedCard) {
			this.selectedCard.classList.remove("friend-card-select");
			this.selectedCard.classList.add("friend-card-unselect");
		}
		card.classList.remove("friend-card-unselect");
		card.classList.add("friend-card-select");
		this.selectedCard = card;
	}

	// GESTION CARTES FRIENDS

	static createFriendCard(displayName: string, avatar: string, isOnline: boolean): HTMLElement {
		const card = document.createElement("div");
		card.className = "friend-card";

		card.innerHTML = `
			<img src="${avatar}" alt="${displayName}" class="friend-avatar">
			<div class="text-m font-semibold">
				${displayName}
			</div>
			<div class="friend-status">
				<div class="${isOnline ? "friend-round-online" : "friend-round-offline"}">
			</div>
			<span class="${isOnline ? "friend-text-online" : "friend-text-offline"}">
				${isOnline ? "Online" : "Offline"}
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
			const acceptRes = await api.patch("/api/friend/accept", { displayName: request.requestFrom });

			if (acceptRes && acceptRes.status == Status.success) {
				notify(`You are now friend with ${request.requestFrom}`, "success");
				card.remove();
				this.loadRooms();
			} else {
				console.error("AcceptRes didn't work");
			}
		};

		const decline = document.createElement("button");
		decline.className = "request-decline";
		decline.textContent = "No";

		decline.onclick = async () => {
			const declineRes = await api.patch("/api/friend/decline", { displayName: request.requestFrom });

			if (declineRes && declineRes.status == Status.success) {
				notify(`You declined friend request from ${request.requestFrom}`, "info");
				card.remove();
			} else {
				console.error("declineRes didn't work");
			}
		};

		requestsBtn?.appendChild(accept);
		requestsBtn?.appendChild(decline);
		return card;
	}

	/** Creates or join a chat room and load it on the page. */
	async loadChat(displayName: string, targetUuid?: string): Promise<void> {
		const userResponse = await api.get("/api/user?displayName=" + displayName);
		if (!userResponse) return;
		if (userResponse.status != Status.success) {
			notify(userResponse.payload.message, "error");
			return;
		}
		const { user } = userResponse.payload as { user: { username: string } };
		if (user.username == this.chat.targetUsername) {
			return;
		}

		const chatName = this.chatContainer.querySelector<HTMLSpanElement>("#chat-name")!;
		const chatList = this.chatContainer.querySelector<HTMLDivElement>("#chat-content")!;

		if (!chatName || !chatList) {
			console.log("Missing chatName or chatList in html");
			return;
		}

		chatList.innerHTML = "";
		this.chat.cleanRoomState();
		await this.chat.openRoom(user.username);
		await this.chat.loadHistory();

		chatName.textContent = displayName;
		chatName.classList.add("hover:text-[#04809F]");
		chatName.classList.add("cursor-pointer");
		chatName.onclick = async () => {
			await gotoUserPage(displayName);
		};
		await this.setRemoveFriendButton(chatName, chatList, displayName);
		await this.setBlockButton(chatName, chatList, displayName);
		this.setVsButton(displayName, targetUuid || "");
		this.renderMessages(chatList);

		if (this.renderInterval) {
			clearInterval(this.renderInterval);
		}

		this.renderInterval = window.setInterval(() => {
			this.renderMessages(chatList);
		}, 300);
	}

	async setBlockButton(chatName: HTMLSpanElement, chatList: HTMLDivElement, targetDisplayname: string) {
		const blockBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-block")!;

		blockBtn.disabled = !this.selectedCard;
		blockBtn.onclick = async () => {
			const confirmBlock = confirm(`Do you want to block ${targetDisplayname} ?`);
			if (!confirmBlock) {
				return;
			}

			const res = await api.post("/api/friend/block", { displayName: targetDisplayname });
			if (res && res.status === Status.success) {
				notify(`${targetDisplayname} is now blocked (Go to his profile to unblock)`, "info");

				await this.loadRooms();

				chatList.innerHTML = "";
				chatName.textContent = chatName.dataset.default!;
				chatName.classList.remove("hover:text-[#04809F]");
				chatName.classList.remove("cursor-pointer");
				chatName.onclick = null;
				this.selectedCard = null;
				this.chat.cleanRoomState();
				blockBtn.disabled = true;
			} else {
				notify(res?.payload.message, "error");
			}
		};
	}

	async setRemoveFriendButton(chatName: HTMLSpanElement, chatList: HTMLDivElement, targetDisplayname: string) {
		const removeBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-remove-friend")!;

		removeBtn.disabled = !this.selectedCard;
		removeBtn.onclick = async () => {
			const confirmBlock = confirm(`Do you want to remove ${targetDisplayname} from friend's list ?`);
			if (!confirmBlock) {
				return;
			}

			const res = await api.delete("/api/friend/remove", { displayName: targetDisplayname });
			if (res && res.status === Status.success) {
				notify(`${targetDisplayname} isn't your friend anymore.`, "info");

				await this.loadRooms();

				chatList.innerHTML = "";
				chatName.textContent = chatName.dataset.default!;
				chatName.classList.remove("hover:text-[#04809F]");
				chatName.classList.remove("cursor-pointer");
				chatName.onclick = null;
				this.selectedCard = null;
				this.chat.cleanRoomState();
				removeBtn.disabled = true;
			} else {
				notify("Error while deleting this friend.", "error");
			}
		};
	}

	setVsButton(targetDisplayname: string, targetUuid: string) {
		const vsBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-1vs1")!;

		vsBtn.disabled = !this.selectedCard;
		vsBtn.onclick = async () => {
			const confirmVs = confirm(`Do you want to play with ${targetDisplayname} ?`);
			if (!confirmVs) {
				return;
			}

			const me = await api.get("/api/user/me");
			if (!me || !me.payload) {
				return;
			}
			if (me.status !== Status.success) {
				return notify("Error when getting user info: " + me.payload.message, "error");
			}
			socket.send({
				source: me.payload.uuid,
				service: "chat",
				topic: "vs:invite",
				content: targetUuid,
			});
		};
	}

	bindSend(): void {
		const form = this.chatContainer.querySelector<HTMLFormElement>("#chat-footer");
		const input = this.chatContainer.querySelector<HTMLInputElement>("#chat-input");

		if (!form || !input) {
			notify("Missing chat input", "error");
			return;
		}
		form.onsubmit = (e) => {
			e.preventDefault();
			this.chat.connect().then((connected) => {
				if (connected && input.value && this.chat.currentRoomId) {
					this.chat.send(input.value);
					input.value = "";
				}
			});
			return false;
		};
	}

	renderMessages(chatList: HTMLDivElement) {
		const msgs = this.chat.getRoomMessages();

		const newMsgs = msgs.slice(this.chat.lastMessage);

		if (!newMsgs.length) {
			return;
		}

		for (let msg of newMsgs) {
			const divMsg = document.createElement("div");
			msg.source === `@${this.chat.username}`
				? divMsg.classList.add("msg-me")
				: divMsg.classList.add("msg-target");
			divMsg.textContent = msg.content;
			chatList.appendChild(divMsg);
		}
		this.chat.lastMessage = msgs.length;
		chatList.scrollTop = chatList.scrollHeight;
	}
}
