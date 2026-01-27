import { api, Status } from "./api.js";
import { notify } from "./utils/notifs.js";
import socket from "./socket.js"

export type FriendStatus = "add" | "sent" | "friend" | "accept" | "blocked";

export class FriendButton {
	container: HTMLElement;
	status: FriendStatus;
	displayName: string;
	button: HTMLButtonElement;
	extraButton?: HTMLButtonElement;
	blockButton?: HTMLButtonElement;


	constructor (displayName :string, initialStatus:FriendStatus ="add")
	{
		this.displayName = displayName;
		this.status = initialStatus;
		this.container = document.createElement("div");
		this.button = document.createElement("button");
		if (this)
		this.button.className = "px-4 py-2 mr-4 rounded bg-black hover:cursor-pointer hover:bg-neutral-900  hover:scale-105 text-white sm:rounded-xl transition";
		this.button.addEventListener("click", () => this.handleClick());
		this.container.appendChild(this.button);


		this.blockButton = document.createElement("button");
		this.blockButton.className = "px-4 py-2 mr-4 rounded bg-red-600 hover:bg-red-700 hover:scale-105 hover:cursor-pointer text-white sm:rounded-xl transition";
		this.blockButton.textContent = "Block";
		this.blockButton.addEventListener("click", () => this.handleBlock());
		this.container.appendChild(this.blockButton);

		this.initStatus();

	}

	private async initStatus ()
	{
		try {
			const resRequest = await api.get(`/api/friends/status?displayName=${this.displayName}`);
			if (resRequest?.status === Status.success)
			{
				const statusRequest = resRequest.payload.status;
				if (statusRequest === "not sent" || statusRequest === "declined")
					this.status= "add";
				else if (statusRequest === "pending_in")
					this.status="accept";
				else if (statusRequest === "accepted")
					this.status="friend";
				else if (statusRequest === "block")
					this.status="blocked";
				else
					this.status="sent";
			}
		}
		catch(e)
		{
			console.error("Friend status didn't work", e);
		}
		this.render();
	}
	private render()
	{
		if (this.extraButton && this.status !== "friend")
		{
			this.extraButton.remove();
			this.extraButton = undefined;
		}
		if (this.blockButton)
		{
			if (this.status === "blocked")
				this.blockButton.style.display = "none";
			else
				this.blockButton.style.display = "inline-block";
		}

		switch(this.status)
		{
			case "add": this.button.textContent = "Add"; break;
			case "sent": this.button.textContent = "Request Sent"; break;
			case "accept": this.button.textContent = "Accept Request"; break;
			case "blocked": this.button.textContent = "Unblock"; break;
			case "friend":
				this.button.textContent = "Remove Friend";
				if (!this.extraButton)
				{
					this.extraButton = document.createElement("button");
					this.extraButton.className = "px-4 py-2 rounded bg-black hover:bg-neutral-900 hover:cursor-pointer hover:scale-105 text-white sm:rounded-xl transition";
					this.extraButton.textContent = "1VS1";
					this.extraButton.addEventListener("click", () => this.handle1vs1());
					this.container.appendChild(this.extraButton);
				}
				break;
		}
	}

	private async handleClick()
	{
		if (this.status === "add")
		{
			const res = await api.post(`/api/friend/request`, { displayName: this.displayName });
			if (res && res.status === Status.success)
			{
				const resFriends =  await api.get(`/api/friends/status?displayName=${this.displayName}`); 
				if(resFriends?.status == Status.success && resFriends.payload.status === "accepted")
					this.status = "friend";
				else
					this.status = "sent";
				this.render();
			}
			else
				 notify( res?.payload?.message || "Error Friend sent", "error");
		}
		else if (this.status == "sent")
		{
			notify("Already sent", "info");
		}
		else if (this.status == "friend")
		{
			const confirmBlock = confirm(`Do you want to Remove ${this.displayName} from friends list?`);
			if (!confirmBlock)
				return;

			const res = await api.delete("/api/friend/remove", {displayName : this.displayName});
			if (res && res.status === Status.success)
			{
				notify(`${this.displayName} Has been deleted from friend list`, "info");
				this.status = "add";
				this.render();
			}
			else
			{
				notify(`Failed to block ${this.displayName}`, "error");
			}
		}
		else if (this.status == "accept")
		{
			const res = await api.patch("/api/friend/accept", {displayName : this.displayName});
			if (res && res.status === Status.success)
			{
				this.status = "friend";
				this.render();
			}
		}
		else if (this.status == "blocked")
		{
			const res = await api.post("/api/friend/unblock", {displayName : this.displayName});
			if (res && res.status == Status.success)
			{
				notify(`${this.displayName} Has been unblocked`, "info");
				this.status = "add";
				this.render();
			}
		}
	}

	private async handleBlock()
	{
		const confirmBlock = confirm(`Do you want to block ${this.displayName}?`);
		if (!confirmBlock)
			return;

		const res = await api.post("/api/friend/block", { displayName: this.displayName  });

		if (res && res.status === Status.success) {
			notify(`${this.displayName} has been blocked`, "info");
			this.status = "blocked";
			this.render();
		}
		else {
			notify("Failed to block user", "error");
		}
	}


	private async handle1vs1()
	{
		const confirmVs = confirm(`Do you want to play with ${this.displayName} ?`)
		if (!confirmVs)
			return;
		const me = await api.get("/api/me");
		const friend = await api.get(`/api/user?displayName=${this.displayName}`);
		if (!me || ! friend || !me.payload || !friend.payload)
			return notify("Error when getting user or friend info", "error");
		if (me.status !== Status.success || friend.status !== Status.success)
			return notify("Error when getting user or friend info: " + me.payload.message, "error");
		socket.send({
			source: me.payload.uuid,
			topic: "vs:invite",
			content : friend.payload.user.uuid,
		});
	}

	public getFriendButton():HTMLElement 
	{
		return this.container;
	}
}


