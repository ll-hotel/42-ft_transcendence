import AppPage from "./AppPage.js";

export default function newHomePage(parent: HTMLElement): HomePage | null {
	return new HomePage(parent);
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
