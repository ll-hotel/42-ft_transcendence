import { api, Status } from "../../api.js";
import { notify } from "../../utils/notifs.js";
import AppPage from "../AppPage.js";
import { Game, Mode } from "../../pong_client_side.js";
import { gotoPage } from "../../PageLoader.js";

export default class PlayMatch implements AppPage {
	html: HTMLElement;
	game: Game | null = null;
	ballSprite: HTMLImageElement;
	paddleSprite: HTMLImageElement;
	p1_DisplayName :HTMLElement | null;
	p2_DisplayName : HTMLElement | null;
	p1_Avatar : HTMLImageElement | null;
	p2_Avatar : HTMLImageElement | null;
	p1_Score : HTMLDivElement | null;
	p2_Score : HTMLDivElement | null;
	matchId: number | null;
	matchWindow : HTMLElement | null;
	matchCanvas : HTMLElement | null;
	
	constructor(html: HTMLElement,ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.html = html;
		this.matchId = null;
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
		return new PlayMatch(html, ball, paddle);
	}
	async loadInto(container: HTMLElement): Promise<void> {
		if (this.game)
		{
			this.game.deinit();
			this.game = null;
		}

		container.innerHTML = "";
		container.appendChild(this.html);

		this.html.querySelectorAll(".ended-match-mess").forEach(el => el.remove());
		this.matchCanvas!.hidden = false;

		const query = new URLSearchParams(location.search);
		this.matchId = new Number(query.get("id")).valueOf();
		const matchResponse = await api.get("/api/game/" + this.matchId);
		if (!matchResponse || matchResponse.status != Status.success) {
			return history.back();
		}
		const res = await api.post("/api/game/launch", { matchId: this.matchId });
		if (res?.status !== Status.success && res?.status !== Status.created) {
			gotoPage("home");
		}

		const match = matchResponse.payload;

		this.p1_DisplayName!.innerText = match.p1.name;
		this.p2_DisplayName!.innerText = match.p2.name;
		this.p1_Avatar!.src = match.p1.avatar.startsWith("/") ? match.p1.avatar : `/${match.p1.avatar}`;
		this.p2_Avatar!.src = match.p2.avatar.startsWith("/") ? match.p2.avatar : `/${match.p2.avatar}`;
		this.p1_Score!.innerText = match.p1.score;
		this.p2_Score!.innerText = match.p2.score;

		const canvas = this.html.querySelector("canvas")!;
		const table_ratio = 9 / 16;
		canvas.width = 1920;
		canvas.height = canvas.width * table_ratio;

		this.game = new Game(this.html, this.ballSprite, this.paddleSprite, Mode.remote, this.matchId);
		this.game.onScore = () => {
			this.onScore();
		};
		this.game.onEnded = () => {
			this.onEnded();
		};
		this.game.init();
	}

	unload(): void {
		this.html.querySelectorAll(".ended-match-mess").forEach(el => el.remove());
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
		const me = await api.get("/api/user/me");

		if (!me || me.status != Status.success)
			return;

		result.className = "ended-match-mess"

		if (me.payload.displayName === this.p1_DisplayName!.textContent)
		{
			if (this.game!.score.p1 > this.game!.score.p2)
			{
				result.innerText =`You won vs ${this.p2_DisplayName!.innerText}! Nice !`;
				result.classList.add("win");
			}
			else
			{
				result.innerText =`You lost vs ${this.p2_DisplayName!.innerText}! Boo !`;
				result.classList.add("loose");
			}
		}
		else {
			if (this.game!.score.p1 < this.game!.score.p2)
			{
				result.innerText =`You won vs ${this.p1_DisplayName!.innerText}! Nice !`;
				result.classList.add("win");
			}
			else
			{
				result.innerText =`You lost vs ${this.p1_DisplayName!.innerText}! Boo !`;
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