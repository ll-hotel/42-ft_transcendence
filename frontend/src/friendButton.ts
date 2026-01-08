import { api, Status } from "./api.js";

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
			case "sent": this.button.textContent = "sent"; break;
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
				 alert( res?.payload?.message || "Error Friend sent");
		}
		else if (this.status == "sent")
		{
			alert("Already send");
		}
		else if (this.status == "friend")
		{
			const res = await api.delete("/api/friend/remove", {displayName : this.displayName});
			if (res && res.status === Status.success)
			{
				alert(`${this.displayName} est supprimé de la liste d'amis !`);
				this.status = "add";
				this.render();
			}
			else
			{
				alert(`Failed to ban friend ${this.displayName}`);
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
		alert("Need to create the 1vs1 moment...");
		//FAIRE EN SORTE DE CREER UN 1VS1 AVEC CE BOUTTON 
	}

	public getFriendButton():HTMLElement 
	{
		return this.container;
	}
}


