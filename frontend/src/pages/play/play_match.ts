import { api } from "../../api.js";
import AppPage from "../AppPage.js";

export default class PlayMatch implements AppPage {
    html: HTMLElement;
    matchId: number | null = null;
    constructor(html: HTMLElement) {
        this.html = html;
    }
    static async new(html: HTMLElement): Promise<AppPage> {
        return new PlayMatch(html);
    }
    async loadInto(container: HTMLElement): Promise<void> {
        const query = new URLSearchParams(location.search);
        const matchId = query.get("id");
        if (!matchId || !isNumber(matchId)) {
            return history.back();
        }
        const matchResponse = await api.get("/api/match/" + matchId);
        if (!matchResponse || matchResponse.status != 200) {
            return history.back();
        }
        const match = matchResponse.payload as {};
        container.appendChild(this.html);
    }
    unload(): void {
        this.html.remove();
    }
};

function isNumber(s: string) {
    function isDigit(n: number) {
        return 0 <= n && n <= 9;
    }
    for (let i = 0; i < s.length; i += 1) {
        if (!isDigit(s.charCodeAt(i))) return false;
    }
    return true;
}