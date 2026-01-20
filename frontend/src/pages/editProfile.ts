import { api, Status } from "../api.js";
import AppPage from "./AppPage.js";
import { notify } from "./utils/notifs.js";

export class editProfile implements AppPage {
	content: HTMLElement;
	userInfo: HTMLDivElement;
	userForm: HTMLFormElement;
	passwordForm: HTMLFormElement;
	twofaForm: HTMLFormElement;
	activateTwofaForm: HTMLFormElement;

	constructor(content: HTMLElement) {
		this.content = content;
		this.userInfo = content.querySelector("#user-info")!;
		this.userForm = content.querySelector("#profile-form")!;
		this.passwordForm = content.querySelector("#password-form")!;
		this.twofaForm = content.querySelector("#twofa-form")!;
		this.activateTwofaForm = content.querySelector("#twofa-activate-form")!;

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
		this.twofaForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitTwofaForm();
			return (false);
		});
		this.activateTwofaForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.submitActivateTwofaForm();
			return (false);
		});
	}

	static new(content: HTMLElement) {
		if (
			!content.querySelector("#profile-form") || !content.querySelector("#password-form")
			|| !content.querySelector("#user-info")
		) {
			return null;
		}
		return new editProfile(content);
	}

	unload(): void {
		this.content.remove();
		this.userForm.querySelector<HTMLInputElement>("[name=avatar]")!.value = "";
		this.userForm.querySelector<HTMLInputElement>("[name=displayname]")!.value = "";
		this.passwordForm.querySelector<HTMLInputElement>("[name=current-password]")!.value = "";
		this.passwordForm.querySelector<HTMLInputElement>("[name=new-password]")!.value = "";
		this.passwordForm.querySelector<HTMLInputElement>("[name=confirm-password]")!.value = "";
		this.hideActivateTwofa();
	}
	async loadInto(container: HTMLElement): Promise<void> {
		container.appendChild(this.content);
		this.hideActivateTwofa();
		await this.loadUserInfo();
	}

	async loadUserInfo() {
		const resMe = await api.get("/api/me");
		if (!resMe || !resMe.payload) {
			return notify("Error when loading user info", "error");
		}
		if (resMe.status != Status.success) {
			return notify("Error when loading user info :" + resMe.payload.message, "error");
		}
		const user = resMe.payload as { displayName: string, avatar: string, twofa: boolean };
		this.updatePreview(user.displayName, user.avatar);

		const enabled = this.twofaForm.querySelector<HTMLInputElement>("[name='twofa-enabled']");
		if (enabled) enabled.checked = user.twofa;
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

<<<<<<< Updated upstream
		if (!displayName && !avatar)
			return notify("No user info to update", "info");
=======
		if (!displayName && !avatar) {
			return alert("No user info to update");
		}
>>>>>>> Stashed changes

		const res = await api.patch("/api/user/profile", { displayName, avatar });
		if (!res || !res.payload) {
			return;
<<<<<<< Updated upstream
		if (res.status !== Status.success)
			return notify("Error when editing user info: " + res.payload.message, "error");
=======
		}
		if (res.status !== Status.success) {
			return alert("Error when editing user info: " + res.payload.message);
		}
>>>>>>> Stashed changes

		this.updatePreview(displayName, avatar);
		this.userForm.reset();*/
	// 	}

	async submitUserForm() {
		const userFormData = new FormData(this.userForm);

		const displayName = userFormData.get("displayname")?.toString();
		// 		const avatar = userFormData.get("avatar")?.toString();
		const avatarFile = userFormData.get("avatar") as File | null;

		if (!displayName && (!avatarFile || avatarFile.size === 0)) {
			return notify("No user info to update", "error");
		}

		if (displayName) {
			const res = await api.patch("/api/user/profile", { displayName });
			if (!res || !res.payload) {
				return;
			}
			if (res.status !== Status.success) {
				return notify(res.payload.message, "error");
			}
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
			if (!res.ok) {
				return notify("Error when uploading avatar", "error");
			}

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

		if (!currentPassword || !newPassword || newPassword !== confirm) {
			return notify("Passwords do not match", "error");
		}

		const res = await api.patch("/api/user/password", { currentPassword, newPassword });

		if (!res || !res.payload) {
			return;
		}
		if (res.status !== Status.success) {
			return notify(res.payload.message, "error");
		}

		this.passwordForm.reset();
		notify("Password updated", "success");
	}

	async submitTwofaForm() {
		const formData = new FormData(this.twofaForm);
		const twofaEnabled = formData.get("twofa-enabled");

		const res = await api.patch("/api/user/twofa", { enable: twofaEnabled == "on" });
		if (!res || !res.payload) {
			return;
		}
		const reply = res.payload as { message: string, qrCode?: string };
		if (res.status == Status.success) {
			return alert(reply.message);
		}
		if (reply.qrCode) {
			this.showActivateTwofa(reply.qrCode);
		} else {
			alert(reply.message);
			this.twofaForm.reset();
		}
	}

	showActivateTwofa(qrCode: string) {
		this.passwordForm.setAttribute("hidden", "");
		this.twofaForm.setAttribute("hidden", "");
		this.activateTwofaForm.removeAttribute("hidden");

		const imgElement = this.activateTwofaForm.querySelector<HTMLImageElement>("#twofa-qrcode");
		if (imgElement) {
			imgElement.src = qrCode;
		}
	}
	hideActivateTwofa() {
		this.passwordForm.removeAttribute("hidden");
		this.twofaForm.removeAttribute("hidden");
		this.activateTwofaForm.setAttribute("hidden", "");
		const img = this.activateTwofaForm.querySelector<HTMLImageElement>("#twofa-qrcode");
		if (img) img.src = "";
	}

	async submitActivateTwofaForm() {
		const formData = new FormData(this.twofaForm);
		const twofaCode = formData.get("twofa-code")?.toString() || null;
		console.log(twofaCode);
		const res = await api.post("/api/user/twofa/activate", { code: twofaCode });
		if (!res) return;
		if (res.status == Status.success) {
			alert("Two factor authentication enabled.");
		} else {
			alert(res.payload.message);
		}
		if (res.status == Status.bad_request) {
			this.twofaForm.reset();
			this.activateTwofaForm.reset();
			this.hideActivateTwofa();
		}
	}

	updatePreview(displayName?: string, avatar?: string) {
		if (displayName) {
			const nameEl = this.content.querySelector("#edit-displayname-preview");
			if (nameEl) {
				nameEl.textContent = displayName;
			}
		}

		if (avatar) {
			const avatarEl = this.content.querySelector<HTMLImageElement>("#edit-avatar-preview");
			if (avatarEl) {
				avatarEl.src = avatar;
			}
		}
	}
}
