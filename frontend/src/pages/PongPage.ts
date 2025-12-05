import { Game } from "../pong.js";
import AppPage from "./AppPage";

// export default function newPongPage(html: HTMLElement): PongPage | null
// {
// 	const content = html.querySelector("#pong-content");
// 	if (content == null)
// 	{
// 		console.log("PongPage -- missing content");
// 		return (null);
// 	}
// 	return new PongPage(html);
// }

export class PongPage implements AppPage
{
	// html: HTMLElement;
	error: HTMLElement;
	content: HTMLElement;
	game: Game;

	private constructor(html: HTMLElement, ball: HTMLImageElement, paddle: HTMLImageElement) {
		this.content = html.querySelector("#pong-content")!;
		this.error = this.content.querySelector("#pong-error")!;

		this.game = new Game(html, ball, paddle);
	}

	static async new(html: HTMLElement): Promise<PongPage | null> {
		const content = html.querySelector("#pong-content");
		const error = content?.querySelector("#pong-error");
		if (!content || !error) {
			console.log("[pong] Missing html");
			return null;
		}
		const ballPromise: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = "/pong_ball.png";
		});
		const paddlePromise: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = "/pong_paddle.png";
		});
		const ball = await ballPromise.catch(reason => {
			console.log(reason);
			return null;
		});
		const paddle = await paddlePromise.catch(reason => {
			console.log(reason);
			return null;
		});
		if (!ball || !paddle) {
			alert("Could not fetch sprites.");
			return null;
		}
		return new PongPage(html, ball, paddle);
	}

	async loadInto(container: HTMLElement) {
		container.appendChild(this.content);
		this.game.game_init();
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

