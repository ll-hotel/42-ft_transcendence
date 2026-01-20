import { api, Status } from "./api.js";
import { notify } from "./pages/utils/notifs.js";
import socket from "./socket.js"

export type FriendStatus = "add" | "sent" | "friend" | "accept";

export class FriendButton {
	container: HTMLElement;
	status: FriendStatus;
	displayName: string;
	button: HTMLButtonElement;
	extraButton?: HTMLButtonElement;

	constructor (displayName :string, initialStatus:FriendStatus ="add")
	{
		this.displayName = displayName;
		this.status = initialStatus;
		this.container = document.createElement("div");
		this.button = document.createElement("button");
		this.button.className = "px-4 py-2 rounded border border-white bg-[#04809F] text-white";
		this.button.addEventListener("click", () => this.handleClick());
		this.container.appendChild(this.button);

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
		switch(this.status)
		{
			case "add": this.button.textContent = "Add"; break;
			case "sent": this.button.textContent = "Sent"; break;
			case "accept": this.button.textContent = "Accept"; break;
			case "friend":
				this.button.textContent = "Friend";
				if (!this.extraButton)
				{
					this.extraButton = document.createElement("button");
					this.extraButton.className = "px-4 py-2 rounded border border-white bg-[#04809F]  text-white";
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
			const res = await api.delete("/api/friend/remove", {displayName : this.displayName});
			if (res && res.status === Status.success)
			{
				notify(`${this.displayName} has been deleted from friend list`, "success");
				this.status = "add";
				this.render();
			}
			else
			{
				notify(`Failed to ban friend ${this.displayName}`, "error");
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
	}

	private async handle1vs1()
	{
		const confirmVs = confirm(`Do you want to play within ${this.displayName} ?`)
		if (!confirmVs)
			return;
		
		const me = await api.get("/api/me");
		const friend = await api.get(`/api/user?displayName=${this.displayName}`);
		if (!me || ! friend || !me.payload || !friend.payload)
			return alert("Error when getting user ou friend info");
		if (me.status !== Status.success || friend.status !== Status.success)
			return alert("Error when getting user ou friend info: " + me.payload.message);
		console.log(me.payload.uuid, friend.payload.user.uuid);
		socket.send({
			source: me.payload.uuid,
			topic: "vs:invite",
			target : friend.payload.user.uuid,
		});
	}

	public getFriendButton():HTMLElement 
	{
		return this.container;
	}
}


