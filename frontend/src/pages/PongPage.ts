import { Game, Mode } from "../pong_client_side.js";
import AppPage from "./AppPage.js";
import { notify } from "../utils/notifs.js";
import {gotoPage} from "../PageLoader.js";

export class PongPage implements AppPage {
	html: HTMLElement;
	game: Game | null = null;
	ballSprite: HTMLImageElement;
	paddleSprite: HTMLImageElement;
	private matchId: number | null = null;
	onclick: () => void;

	private constructor(html: HTMLElement, ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.html = html;
		this.ballSprite = ball;
		this.paddleSprite = paddle;
		this.onclick = () => this.showGame();
	}

	static async new(html: HTMLElement): Promise<PongPage | null> {
		const ballPromise = fetchImage("/pong_ball.png");
		const paddlePromise = fetchImage("/pong_paddle.png");
		const ball = await ballPromise;
		const paddle = await paddlePromise;
		if (!ball || !paddle) {
			notify("Could not fetch sprites.", "error");
			return null;
		}
		return new PongPage(html, ball, paddle);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.html);
		const params = new URLSearchParams(location.search);
		const matchId = params.get("matchId");
		if (!matchId) {
			return gotoPage("home");
		}
		this.matchId = Number(matchId);
		this.showGame();
		const canvas = this.html.querySelector("canvas")!;
		// const table_ratio = 9 / 16;
		canvas.width = 1800;
		canvas.height = 900;

		// TODO changer le Mode ("local")
		// TODO: Change game mode dynamically.

		this.game = new Game(this.html, this.ballSprite, this.paddleSprite, Mode.remote, this.matchId!);
		this.game.init();
	}

	unload() {
		this.game?.deinit();
		this.game = null;
		this.html.remove();
	}

	showStart() {
		this.onclick = () => this.showGame();
		this.html.querySelector("#panel-start")?.removeAttribute("hidden");
		this.html.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.html.querySelector("#panel-pause")?.setAttribute("hidden", "");
		this.html.querySelector("#panel-score")?.setAttribute("hidden", "");
		this.game?.init();
	}
	showGame() {
		this.html.querySelector("#panel-start")?.setAttribute("hidden", "");
		this.html.querySelector("#panel-game")?.removeAttribute("hidden");
		// this.game.start();
		// setTimeout(() => this.showScore(), 5000);
	}
	showScore() {
		if (!this.game) return;
		this.onclick = () => this.showStart();
		const scorePanel = this.html.querySelector<HTMLDivElement>("#panel-score");
		if (scorePanel) {
			const score = this.game.score;
			if (score.p1 > score.p2) {
				scorePanel.innerHTML = "<p>Player 1 Won!</p>";
			} else if (score.p2 > score.p1) {
				scorePanel.innerHTML = "<p>Player 2 Won!</p>";
			} else {
				scorePanel.innerHTML = "It's a tie!";
			}
			scorePanel.innerHTML += "<br>" + `<p>${score.p1} : ${score.p2}</p>`;
			scorePanel.removeAttribute("hidden");
		}
		this.html.querySelector("#panel-start")?.setAttribute("hidden", "");
		this.html.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.html.querySelector("#panel-pause")?.setAttribute("hidden", "");
		setTimeout(() => this.showStart(), 5000);
	}
}

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
