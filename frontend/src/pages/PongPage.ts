import { Game } from "../pong.js";
import AppPage from "./AppPage.js";

export class PongPage implements AppPage {
	content: HTMLElement;
	game: Game;
	onclick: () => void;

	private constructor(html: HTMLElement, ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.content = html;
		this.game = new Game(html, ball, paddle);

		html.querySelector("#game-clickbox")?.addEventListener("click", () => this.onclick());
		this.onclick = () => this.showGame();
	}

	static async new(html: HTMLElement): Promise<PongPage | null> {
		const error = true;
		if (!error) {
			console.log("[pong] Missing html");
			return null;
		}
		const ballPromise = fetchImage("/pong_ball.png");
		const paddlePromise = fetchImage("/pong_paddle.png");
		const ball = await ballPromise;
		const paddle = await paddlePromise;
		if (!ball || !paddle) {
			alert("Could not fetch sprites.");
			return null;
		}
		return new PongPage(html, ball, paddle);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.content);
		this.showStart();
	}

	unload() {
		this.content.remove();
	}

	showStart() {
		this.onclick = () => this.showGame();
		this.content.querySelector("#panel-start")?.removeAttribute("hidden");
		this.content.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-pause")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-score")?.setAttribute("hidden", "");
	}
	showGame() {
		this.onclick = () => this.showPause();
		this.content.querySelector("#panel-start")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-game")?.removeAttribute("hidden");
		// this.game.start();
		setTimeout(() => this.showScore(), 5000);
	}
	showPause() {
		this.onclick = () => this.hidePause();
		this.content.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-pause")?.removeAttribute("hidden");
		// this.game.pause();
	}
	hidePause() {
		this.onclick = () => this.showPause();
		this.content.querySelector("#panel-pause")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-game")?.removeAttribute("hidden");
		// this.game.resume();
	}
	showScore() {
		this.onclick = () => this.showStart();
		const scorePanel = this.content.querySelector("#panel-score");
		if (scorePanel) {
			const score = this.game.score;
			if (score.p1 > score.p2) {
				scorePanel.innerHTML = "<p>Player 1 Won!</p>";
			} else if (score.p2 > score.p1) {
				scorePanel.innerHTML = "<p>Player 2 Won!</p>";
			} else {
				scorePanel.innerHTML = "It's a tie!"
			}
			scorePanel.innerHTML += "<br>" + `<p>${score.p1} : ${score.p2}</p>`;
			scorePanel.removeAttribute("hidden");
		}
		this.content.querySelector("#panel-start")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-pause")?.setAttribute("hidden", "");
		// this.game.end();
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
