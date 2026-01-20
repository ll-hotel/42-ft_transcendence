import AppPage from "./AppPage.js";
import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import { notify } from "./utils/notifs.js";

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

		const avatarInput = this.userForm.querySelector<HTMLInputElement>("[name=avatar]")!;
		const avatarPreview = this.content.querySelector<HTMLImageElement>("#edit-avatar-preview")!;

		avatarInput.addEventListener("change", () => {
			const file = avatarInput.files?.[0];
			if (!file) return;
			
			const imgTypes = ["image/png", "image/jpeg", "image/webp"];

			if (!imgTypes.includes(file.type)) {
				notify("File must be a PNG, JPG or WEBP image", "error");
				avatarInput.value = "";
				return;
			}

			if (file.size > (2 * 1024 * 1024)) {
				notify("Image is too large (max 2MB)", "error");
				avatarInput.value = "";
				return;
  			}

			const reader = new FileReader();
			reader.onload = () => {
				avatarPreview.src = reader.result as string;
			};
			reader.readAsDataURL(file);
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
				return notify("Error when loading user info", "error");
			if ( resMe.status != Status.success)
				return notify("Error when loading user info :" + resMe.payload.message, "error");
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
/*	async submitUserForm() {
		const userFormData = new FormData(this.userForm);

		const displayName = userFormData.get("displayname")?.toString();
		const avatar = userFormData.get("avatar")?.toString();
		const avatarFile = userFormData.get("avatar") as File | null;
		
		if (!displayName && (!avatarFile || avatarFile.size === 0))
			return alert("No user info to update");
		
		if (displayName) {
			const res = await api.patch("/api/user/profile", {displayName});
			if (!res || !res.payload)
				return;
			if (res.status !== Status.success)
				return alert("Error when editing user info: " + res.payload.message);
			this.updatePreview(displayName);
		}

		if (avatarFile && avatarFile.size > 0) {
			const fd = new FormData();
			fd.append("avatar", avatarFile);

			const res = await fetch("/api/user/updateAvatar", {
				method: "POST",
				credentials: "include",
				body: fd,
			});
			if (!res.ok)
				return alert("Error when uploading avatar");
			
			const data = await res.json();
			this.updatePreview(undefined, `uploads/${data.file}`);
		}*/
/*		const avatar = userFormData.get("avatar")?.toString();

		if (!displayName && !avatar)
			return notify("No user info to update", "info");

		const res = await api.patch("/api/user/profile", {displayName, avatar});
		if (!res || !res.payload)
			return;
		if (res.status !== Status.success)
			return notify("Error when editing user info: " + res.payload.message, "error");

		this.updatePreview(displayName, avatar);
		this.userForm.reset();*/
//	}

	async submitUserForm() {
		const userFormData = new FormData(this.userForm);

		const displayName = userFormData.get("displayname")?.toString();
//		const avatar = userFormData.get("avatar")?.toString();
		const avatarFile = userFormData.get("avatar") as File | null;
		
		if (!displayName && (!avatarFile || avatarFile.size === 0))
			return notify("No user info to update", "error");
		
		if (displayName) {
			const res = await api.patch("/api/user/profile", {displayName});
			if (!res || !res.payload)
				return;
			if (res.status !== Status.success)
				return notify(res.payload.message, "error");
			notify("Display Name updated", "success");
			this.updatePreview(displayName);
		}

		if (avatarFile && avatarFile.size > 0) {
			const fd = new FormData();
			fd.append("avatar", avatarFile);

			const res = await fetch("/api/user/updateAvatar", {
				method: "POST",
				credentials: "include",
				body: fd,
			});
			if (!res.ok)
				return notify("Error when uploading avatar", "error");
			
			const data = await res.json();
			this.updatePreview(undefined, `uploads/${data.file}`);
			notify("Avatar updated", "success");
		}
		this.userForm.reset();
	}

	async submitPasswordForm() {
		const formData = new FormData(this.passwordForm);

		const currentPassword = formData.get("current-password")?.toString();
		const newPassword = formData.get("new-password")?.toString();
		const confirm = formData.get("confirm-password")?.toString();

	if (!currentPassword || !newPassword || newPassword !== confirm)
		return notify("Passwords do not match", "error");

	const res = await api.patch("/api/user/password", {currentPassword, newPassword});

	if (!res || !res.payload)
		return;
	if (res.status !== Status.success)
		return notify(res.payload.message, "error");

	this.passwordForm.reset();
	notify("Password updated", "success");
}

	updatePreview(displayName?: string, avatar?: string) {
		if (displayName) {
			const nameEl = this.content.querySelector("#edit-displayname-preview");
			if (nameEl)
				nameEl.textContent = displayName;
		}

		if (avatar) {
			const avatarEl = this.content.querySelector<HTMLImageElement>("#edit-avatar-preview");
			if (!avatarEl)
				return;
			avatarEl.src = avatar.startsWith("/") ? avatar : `/${avatar}`;
		}
}


}
