import AppPage from "./AppPage.js";

export default function newHomePage(html: HTMLElement): HomePage | null {
	return new HomePage(html);
}

export class HomePage implements AppPage {
	html: HTMLElement;

	constructor(html: HTMLElement) {
		this.html = html;
	}

	loadInto(container: HTMLElement): void {
		container.appendChild(this.html);
	}

	unload(): void {
		this.html.remove();
	}
}
