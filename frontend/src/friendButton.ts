import { api, Status } from "./api.js";

export type FriendStatus = "add" | "send" | "friend";

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
		this.button.className = "px-4 py-2 rounded border border-white bg-blue-500  text-white";
		this.button.addEventListener("click", () => this.handleClick());
		this.container.appendChild(this.button);

		this.initStatus();

	}

	private async initStatus ()
	{
		try {
			const resFriends = await api.get("/api/friends"); //personne avec lequels je suis pote !
			const resRequest = await api.get("/api/friend/requests"); // si j'ai recu une invitation de cette personne / ne m'impacte pas pas la bonne utilisation
			if (resFriends?.status == Status.success && resFriends.payload.friends.some((friend:any) =>friend.displayName == this.displayName))
					this.status= "friend";
			else if (resRequest?.status == Status.success)
			{
				const allPendings = resRequest.payload.requests;
				if (allPendings.some((pending:any) =>pending.requestFrom == this.displayName))
				{
					this.status= "add";
				}
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
		switch(this.status)
		{
			case "add": this.button.textContent = "Add"; break;
			case "send": this.button.textContent = "Send"; break;
			case "friend": this.button.textContent = "friend"; break;

		}
	}

	private async handleClick()
	{
		if (this.status == "add")
		{
			const res = await api.post(`/api/friend/request`, { displayName: this.displayName })
			if (res && res.status == Status.success)
			{
				const resFriends = await api.get("/api/friends"); 
				if(resFriends?.status == Status.success && resFriends.payload.friends.some((friend:any) =>friend.displayName == this.displayName))
					this.status = "friend";
				else
					this.status = "send";
				this.render();
			}
			else
				 alert( res?.payload?.message || "Error Friend send");
		}
		else if (this.status == "send")
		{
			alert("Already send");
		}
		else if (this.status == "friend")
		{
			const res = await api.post("/api/friend/remove", {displayName : this.displayName})
			if (res && res.status === Status.success) {
				alert(`${this.displayName} is now out of your friends list !`)
				this.status = "add";
				this.render();
			}
			else
			{
				alert(`Failed to ban friend ${this.displayName}`);
			}
			//creer button 1vs1
		}
	}

	public getFriendButton():HTMLElement 
	{
		return this.container;
	}
}


