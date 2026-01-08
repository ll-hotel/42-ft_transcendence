import AppPage from "./AppPage.js";
import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";

export class editProfile implements AppPage
{
	content: HTMLElement;
	userInfo : HTMLDivElement;
	userForm : HTMLFormElement;
	passwordForm:HTMLFormElement;

	constructor(content: HTMLElement) {
		this.content = content;
		this.userInfo = content.querySelector("#user-info")!;
		this.userForm = content.querySelector("#profile-form")!;
		this.passwordForm = content.querySelector("#password-form")!;

		this.userForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitUserForm();
			return (false);
		});
		this.passwordForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitPasswordForm();
			return (false);
		});
	}

	static new(content: HTMLElement) {
		if (!content.querySelector("#profile-form") || !content.querySelector("#password-form") || !content.querySelector("#user-info"))
			return null;
		return new editProfile(content);
	}

	unload(): void {
		this.content.remove();
		(this.userForm.querySelector("[name=avatar]")! as HTMLInputElement).value = "";
		(this.userForm.querySelector("[name=displayname]")! as HTMLInputElement).value = "";
		(this.passwordForm.querySelector("[name=current-password]")! as HTMLInputElement).value = "";
		(this.passwordForm.querySelector("[name=new-password]")! as HTMLInputElement).value = "";
		(this.passwordForm.querySelector("[name=confirm-password]")! as HTMLInputElement).value = "";
	}
	async loadInto(container: HTMLElement): Promise<void> {
		container.appendChild(this.content);
		await this.loadUserInfo();
	}


	async loadUserInfo() {
		let userInfo;
		if (!userInfo) {
			const resMe = await api.get("/api/me");
			if (!resMe || !resMe.payload)
				return alert("Error when loading user info");
			if ( resMe.status != Status.success)
				return alert("Error when loading user info :" + resMe.payload.message);
			userInfo = JSON.stringify(resMe.payload);
		}
		try {
			const user = JSON.parse(userInfo);
			this.updatePreview(user.displayName, user.avatar);
		}
		catch
		{
			
		}
	}
	async submitUserForm() {
		const userFormData = new FormData(this.userForm);

		const displayName = userFormData.get("displayname")?.toString();
		const avatar = userFormData.get("avatar")?.toString();

		if (!displayName && !avatar)
			return alert("No user info to update");

		const res = await api.patch("/api/user/profile", {displayName, avatar});
		if (!res || !res.payload)
			return;
		if (res.status !== Status.success)
			return alert("Error when editing user info: " + res.payload.message);

		this.updatePreview(displayName, avatar);
		this.userForm.reset();
	}

	async submitPasswordForm() {
		const formData = new FormData(this.passwordForm);

		const currentPassword = formData.get("current-password")?.toString();
		const newPassword = formData.get("new-password")?.toString();
		const confirm = formData.get("confirm-password")?.toString();

	if (!currentPassword || !newPassword || newPassword !== confirm || newPassword.length <= 8) {
		return alert("Passwords do not match");
	}

	const res = await api.patch("/api/user/password", {currentPassword, newPassword});

	if (!res || !res.payload)
		return;
	if (res.status !== Status.success)
		return alert("Error when edit password: " + res.payload.message);

	this.passwordForm.reset();
	alert("Password updated");
}

	updatePreview(displayName?: string, avatar?: string) {
		if (displayName) {
			const nameEl = this.content.querySelector("#edit-displayname-preview");
			if (nameEl)
				nameEl.textContent = displayName;
		}

		if (avatar) {
			const avatarEl = this.content.querySelector<HTMLImageElement>("#edit-avatar-preview");
			//if (avatarEl)
			//	avatarEl.src = avatar; Besoin d'avoir une image bien implanté dans le back !
		}
}


}