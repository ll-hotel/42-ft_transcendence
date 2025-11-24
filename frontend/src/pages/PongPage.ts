import { Game } from "../pong.js";
import AppPage from "./AppPage";


export default function newPongPage(html: HTMLElement): PongPage | null
{
	const content = html.querySelector("#pong-content");
	if (content == null)
	{
		console.log("PongPage -- missing content");
		return (null);
	}
	return new PongPage(html);
}

export class PongPage implements AppPage
{
	html: HTMLElement;
	css: HTMLLinkElement | null;
	content: HTMLElement;
	game: Game;

	constructor(html: HTMLElement)
	{
		this.html = html;
		this.css = html.querySelector("link");
		this.content = html.querySelector("#pong-content")!;
		this.game = new Game(html);
	}

	loadInto(container: HTMLElement): void {
		if (this.css)
			document.head.appendChild(this.css);
		container.appendChild(this.content);
		this.start();
	}

	unload(): void {
		if (this.css)
			this.css.remove();
		this.content.remove();
	}

	start()
	{
		this.game.game_init();
	}
}

