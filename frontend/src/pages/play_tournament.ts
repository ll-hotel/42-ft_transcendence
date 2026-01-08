import AppPage from "./AppPage.js";

export default class PlayTournament implements AppPage {
	html: HTMLElement;
	constructor(html: HTMLElement) {
		this.html = html;
	}
	static new(html: HTMLElement): AppPage | null {
		return new PlayTournament(html);
	}
    loadInto(container: HTMLElement): void {
        container.appendChild(this.html);
    }
    unload(): void {
        this.html.remove();
    }
}
