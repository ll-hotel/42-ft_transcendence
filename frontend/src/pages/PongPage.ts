import { Game } from "../pong.js";
import AppPage from "./AppPage.js";

export class PongPage implements AppPage {
	// html: HTMLElement;
	error: HTMLElement;
	content: HTMLElement;
	game: Game;

	private constructor(html: HTMLElement, ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.content = html;
		this.error = this.content.querySelector("#pong-error")!;
		this.game = new Game(html, ball, paddle);

		const startPanel = html.querySelector("#panel-start");
		startPanel?.addEventListener("click", () => {
			startPanel.setAttribute("hidden", "");
			html.querySelector("#panel-game")?.removeAttribute("hidden");
			// TODO: Start game.
			this.game.game_init();
		});
	}

	static async new(html: HTMLElement): Promise<PongPage | null> {
		const error = html.querySelector("#pong-error");
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
		this.content.querySelector("#panel-start")?.removeAttribute("hidden");
		this.content.querySelector("#panel-game")?.setAttribute("hidden", "");
		this.content.querySelector("#panel-score")?.setAttribute("hidden", "");
		
		// this.game.game_init();
	}

	unload() {
		this.content.remove();
	}

	setError(error: string) {
		this.error.innerHTML = error;
		if (this.error.innerHTML.length == 0) {
			this.error.setAttribute("hidden", "");
		} else {
			this.error.removeAttribute("hidden");
		}
	}

	// start()
	// {
	// 	this.game.game_init();
	// }
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
