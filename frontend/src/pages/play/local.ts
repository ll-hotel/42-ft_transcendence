import { api, Status } from "../../api.js";
import { notify } from "../../utils/notifs.js";
import AppPage from "../AppPage.js";
import { Game, Mode } from "../../pong_client_side.js";
import { gotoPage, gotoUserPage} from "../../PageLoader.js";

export default class PlayLocal implements AppPage {
	html: HTMLElement;
	game: Game | null = null;
	me : User | null;

	ballSprite: HTMLImageElement;
	paddleSprite: HTMLImageElement;
	p1_DisplayName :HTMLElement | null;
	p2_DisplayName : HTMLElement | null;
	p1_Avatar : HTMLImageElement | null;
	p2_Avatar : HTMLImageElement | null;
	p1_Score : HTMLDivElement | null;
	p2_Score : HTMLDivElement | null;
	matchId: string | null;
	matchWindow : HTMLElement | null;
	matchCanvas : HTMLElement | null;
	
	constructor(html: HTMLElement,ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.html = html;
		this.matchId = null;
		this.me = null;
		this.p1_DisplayName = this.html.querySelector<HTMLElement>("#player1-name");
		this.p2_DisplayName = this.html.querySelector<HTMLElement>("#player2-name");
		this.p1_Avatar = this.html.querySelector<HTMLImageElement>("#player1-picture");
		this.p2_Avatar = this.html.querySelector<HTMLImageElement>("#player2-picture");
		this.p1_Score = this.html.querySelector<HTMLDivElement>("#player1-score");
		this.p2_Score = this.html.querySelector<HTMLDivElement>("#player2-score");
		this.matchWindow = this.html.querySelector<HTMLDivElement>("#match-content");
		this.matchCanvas = this.html.querySelector<HTMLDivElement>("#match-canvas");
		this.ballSprite = ball;
		this.paddleSprite = paddle;

		if (!this.p1_DisplayName || !this.p2_DisplayName || !this.p1_Avatar ||!this.p2_Avatar || !this.p1_Score || !this.p2_Score || !this.matchWindow || !this.matchCanvas)
			return;
	}
	static async new(html: HTMLElement): Promise<AppPage | null> {
		const ballPromise = fetchImage("/pong_ball.png");
		const paddlePromise = fetchImage("/pong_paddle.png");
		const ball = await ballPromise;
		const paddle = await paddlePromise;
		if (!ball || !paddle) {
			notify("Could not fetch sprites.", "error");
			return null;
		}
		return new PlayLocal(html, ball, paddle);
	}
	async loadInto(container: HTMLElement): Promise<void> {
		if (this.game)
		{
			this.game.deinit;
			this.game = null;
		}
		const prevMess = this.matchWindow!.querySelector(".ended-match-mess")
		if (prevMess)
		{
			prevMess.remove();
			this.matchCanvas!.hidden = false;
		}

		initSearchBar()











		const resMe = await api.get("api/me");
		if (!resMe || resMe.status != Status.success) {
			return history.back();
		}
		const me = resMe.payload;

		this.p1_DisplayName!.innerHTML = me.displayName;
//		this.p2_DisplayName!.innerHTML = match.p2.name;
		this.p1_Avatar!.src = me.avatar.startsWith("/") ? me.avatar : `/${me.avatar}`;
//		this.p2_Avatar!.src = match.p2.avatar.startsWith("/") ? match.p2.avatar : `/${match.p2.avatar}`;

//		this.p2_Score!.innerText = match.p2.score;

		const canvas = this.html.querySelector("canvas")!;
		const table_ratio = 9 / 16;
		canvas.width = 1920;
		canvas.height = canvas.width * table_ratio;

		this.game = new Game(this.html, this.ballSprite, this.paddleSprite, Mode.local);
		this.game.onScore = () => {
			this.onScore();
		};
		this.game.onEnded = () => {
			this.onEnded();
		};
		this.game.init();

		container.innerHTML = "";
		container.appendChild(this.html);
	}

	unload(): void {
		this.game?.deinit();
		this.game = null;
		this.html.remove();
	}


	onScore() {
		this.p1_Score!.innerText = this.game!.score?.p1.toString();
		this.p2_Score!.innerText = this.game!.score?.p2.toString();
}

	async onEnded() {
		this.matchCanvas!.hidden = true;
		const result = document.createElement("div");
		const me = await api.get("/api/me");

		if (!me || me.status != Status.success)
			return;

		result.className = "ended-match-mess"

		if (me.payload.displayName === this.p1_DisplayName!.textContent)
		{
			if (this.game!.score.p1 > this.game!.score.p2)
			{
				result.innerText =`You win in front of ${this.p2_DisplayName!.innerText}! Nice !`;
				result.classList.add("win");
			}
			else
			{
				result.innerText =`You lose in front of ${this.p2_DisplayName!.innerText}! Boo !`;
				result.classList.add("loose");
			}
		}
		else {
			if (this.game!.score.p1 < this.game!.score.p2)
			{
				result.innerText =`You win in front of ${this.p1_DisplayName!.innerText}! Nice !`;
				result.classList.add("win");
			}
			else
			{
				result.innerText =`You lose in front of ${this.p1_DisplayName!.innerText}! Boo !`;
				result.classList.add("loose");
			}
		}

		this.matchWindow!.appendChild(result);
		notify(`The match n°${this.matchId} is finished`, "success");
		setTimeout( () => {
			gotoPage("home");
		}, 4000);
	}
};
async function fetchImage(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	}).catch(function(reason) {
		console.log(reason);
		return null;
	}) as Promise<HTMLImageElement | null>;
}

function initSearchBar() {
	const search = document.getElementById("input-p2") as HTMLInputElement | null;
	const result = document.getElementById("results-p2") as HTMLDivElement | null;

	if (!search || !result) {
		return;
	}

	search.addEventListener("input", async () => {
		const searchName = search.value.trim().toLowerCase();

		if (searchName.length == 0) {
			result.innerHTML = "";
			return;
		}

		const allUsers = await api.get("/api/users/all");

		if (!allUsers || !allUsers.payload || !allUsers.payload.users) {
			result.innerHTML = "<div>Pas d'utilisateurs chargés</div>";
			return;
		}

		const selectedUsers = allUsers.payload.users.filter((user: any) => {
			return user.displayName.toLowerCase().includes(searchName);
		});

		displayResultSearch(selectedUsers);
	});

	function displayResultSearch(selectedUsers: any) {
		const results = document.getElementById("results-p2");
		if (!results) {
			return;
		}
	
		results.innerHTML = "";
		selectedUsers.forEach((user: any) => {
			if (user.displayName === this.me.displayName)
				return;
			const card = document.createElement("div");
			card.className = "user-result";
	
			const avatar = document.createElement("img");
			avatar.src =  user.avatar.startsWith("/") ? user.avatar : `/${user.avatar}`;
			avatar.className = "result-avatar";
	
			const name = document.createElement("span");
			name.textContent = user.displayName;
			name.className = "result-name";
	
			card.appendChild(avatar);
			card.appendChild(name);
	
			card.onclick = async () => {
				const me = await api.get("/api/me");
				if (!me || !me.payload)
					return;
				if (me.status != Status.success)
					return notify("Error: " + me.payload.message, "error");
				if (me.payload.displayName == user.displayName)
					await gotoPage("profile");
				else
					await gotoUserPage(user.displayName);
			}
	
			results.appendChild(card);
	
		}
		)
	}
}