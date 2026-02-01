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
		this.hideButtons();
		this.toggleChatInput("off");
		container.appendChild(this.content);
		await this.chat.connect();
		await this.loadRooms();
	}

	unload(): void {
		this.content.remove();
		this.toggleChatInput("off");

		this.cardsDisplayNames = [];
		if (this.renderInterval) {
			clearInterval(this.renderInterval);
			this.renderInterval = null;
		}
		this.chat.reset();
		this.unselectCard();
	}

	toggleChatInput(state: "on" | "off") {
		const chatInput = this.chatContainer.querySelector<HTMLInputElement>("#chat-input");
		if (chatInput) {
			chatInput.disabled = state == "off";
		}
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
					this.loadChat(friend.displayName, friend.uuid);
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
				const { displayName, avatar, isOnline, uuid } = userRes.payload.user as {
					displayName: string,
					avatar: string,
					isOnline: boolean,
					uuid : string,
				};
				const card = FriendPage.createFriendCard(displayName, avatar, isOnline);
				card.onclick = () => {
					this.switchRoomCard(card);
					this.loadChat(displayName, uuid);
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
	async loadChat(displayName: string, uuid?: string): Promise<void> {
		const userResponse = await api.get("/api/user?displayName=" + displayName);
		if (!userResponse) return;
		if (userResponse.status != Status.success) {
			notify(userResponse.payload.message, "error");
			return;
		}
		const { user } = userResponse.payload as { user: { username: string, uuid: string } };
		if (!uuid) {
			uuid = user.uuid;
		}
		if (user.username == this.chat.targetUsername) {
			return;
		}

		const buttonProfile = this.chatContainer.querySelector<HTMLSpanElement>("#button-profile")!;
		if (buttonProfile) {
			buttonProfile.removeAttribute("hidden");
			buttonProfile.onclick = () => gotoUserPage(displayName);
		}

		const chatName = this.chatContainer.querySelector<HTMLSpanElement>("#chat-name")!;
		const chatList = this.chatContainer.querySelector<HTMLDivElement>("#chat-content")!;

		if (!chatName || !chatList) {
			console.log("Missing chatName or chatList in html");
			return;
		}

		if (!await this.chat.openRoom(user.username)) {
			this.unselectCard();
			return;
		}
		await this.chat.loadHistory();

		chatName.textContent = displayName;
		await this.setRemoveFriendButton(displayName);
		await this.setBlockButton(displayName);
		this.setVsButton(displayName, uuid);
		this.renderMessages(chatList);
		this.toggleChatInput("on");

		if (this.renderInterval) {
			clearInterval(this.renderInterval);
		}

		this.renderInterval = window.setInterval(() => {
			this.renderMessages(chatList);
		}, 300);

		this.showButtons();
	}

	hideButtons(): void {
		const buttons = this.chatContainer.querySelector<HTMLElement>("#chat-friend-buttons");
		if (buttons) {
			buttons.setAttribute("hidden", "");
		}
		const profileButton = this.chatContainer.querySelector<HTMLElement>("#button-profile");
		if (profileButton) {
			profileButton.setAttribute("hidden", "");
		}
	}
	showButtons(): void {
		const buttons = this.chatContainer.querySelector<HTMLElement>("#chat-friend-buttons");
		if (buttons) {
			buttons.removeAttribute("hidden");
		}
	}

	async setBlockButton(displayName: string) {
		const blockBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-block")!;
		blockBtn.disabled = true;

		const isBlockedRes = await api.post("/api/friend/isblocked", { displayName });
		if (!isBlockedRes || isBlockedRes.status != Status.success) {
			return;
		}
		if (isBlockedRes.payload.blocked) {
			blockBtn.disabled = false;
			blockBtn.innerText = "Unblock";
			blockBtn.onclick = async () => {
				const unblockRes = await api.post("/api/friend/unblock", { displayName: displayName });
				if (unblockRes && unblockRes.status === Status.success) {
					notify(`${displayName} unblocked`, "success");
					this.unselectCard();
				} else {
					notify(unblockRes?.payload.message, "error");
				}
			};
		} else {
			blockBtn.disabled = false;
			blockBtn.innerText = "Block";
			blockBtn.onclick = async () => {
				const blockRes = await api.post("/api/friend/block", { displayName: displayName });
				if (blockRes && blockRes.status === Status.success) {
					notify(`${displayName} is blocked`, "info");
					this.unselectCard();
				} else {
					notify(blockRes?.payload.message, "error");
				}
			};
		}
	}

	async setRemoveFriendButton(displayName: string) {
		const removeBtn = this.chatContainer.querySelector<HTMLButtonElement>("#button-remove-friend")!;

		removeBtn.disabled = false;
		removeBtn.onclick = async () => {
			const res = await api.delete("/api/friend/remove", { displayName: displayName });
			if (res && res.status === Status.success) {
				notify(`${displayName} isn't your friend anymore.`, "info");
				removeBtn.disabled = true;
				this.unselectCard();
			} else {
				notify("Error while deleting this friend.", "error");
			}
		};
		api.get("/api/friend/status?displayName=" + displayName).then(statusRes => {
			if (!statusRes) return;
			if (statusRes && statusRes.status != Status.success) {
				return notify(statusRes.payload.message, "error");
			}
			const status = statusRes.payload.status as string;
			if (status == "accepted") {
				return;
			}
			removeBtn.disabled = false;
			removeBtn.innerText = "Send friend request";
			removeBtn.onclick = async () => {
				const requestRes = await api.post("/api/friend/request", { displayName });
				if (!requestRes) return;
				if (requestRes.status != Status.success) {
					return notify(requestRes.payload.message, "error");
				}
				notify("Friend request sent", "info");
				removeBtn.disabled = true;
				this.unselectCard();
			};
		});
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
					form.reset();
				}
			});
			return false;
		};
	}

	unselectCard(): void {
		const chatList = this.chatContainer.querySelector<HTMLElement>("#chat-content");
		if (chatList) {
			chatList.innerText = "";
		}
		const chatName = this.chatContainer.querySelector<HTMLElement>("#chat-name");
		if (chatName) {
			chatName.textContent = chatName.dataset.default!;
			chatName.classList.remove("hover:text-[#04809F]");
			chatName.classList.remove("cursor-pointer");
		}
		this.toggleChatInput("off");
		if (this.selectedCard) {
			this.selectedCard.classList.remove("friend-card-select");
			this.selectedCard.classList.add("friend-card-unselect");
		}
		this.selectedCard = null;
		this.loadRooms();
		this.chat.cleanRoomState();
		this.hideButtons();
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
