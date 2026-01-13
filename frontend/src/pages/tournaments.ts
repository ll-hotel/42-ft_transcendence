import AppPage from "./AppPage.js";

export class Tournaments implements AppPage {
	html: HTMLElement;
	private constructor(html: HTMLElement) {
		this.html = html;
	}
	static new(html: HTMLElement): AppPage | null {
		return new Tournaments(html);
	}
	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
	}
	unload(): void {
		this.html.remove();
	}
}
