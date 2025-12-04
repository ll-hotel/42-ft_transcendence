import { Game } from "../pong.js";
import AppPage from "./AppPage";
import { gotoPage } from "../PageLoader.js";

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

	private constructor(html: HTMLElement) {
		this.content = html.querySelector("#auth-content")!;
		this.error = this.content.querySelector("#auth-error")!;
		this.game = new Game(html);
	}

	static new(html: HTMLElement): PongPage | null {
		const content = html.querySelector("#pong-content");
		const error = content?.querySelector("#pong-error");
		if (!content || !error) {
			console.log("[pong] Missing html");
			return null;
		}
		return new PongPage(html);
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

