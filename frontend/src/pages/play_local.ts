import AppPage from "./AppPage.js";

export default class PlayLocal implements AppPage {
    html: HTMLElement;
    constructor(html: HTMLElement) {
        this.html = html;
    }
    static async new(html: HTMLElement): Promise<AppPage> {
        return new PlayLocal(html);
    }
    loadInto(container: HTMLElement): void {
        container.appendChild(this.html);
    }
    unload(): void {
        this.html.remove();
    }
};
