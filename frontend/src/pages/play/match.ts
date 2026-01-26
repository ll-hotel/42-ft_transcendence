import { api } from "../../api.js";
import AppPage from "../AppPage.js";

export default class PlayMatch implements AppPage {
	html: HTMLElement;
	myDisplayName :HTMLElement | null;
	vsDisplayName : HTMLElement | null;
	myAvatar : HTMLImageElement | null;
	vsAvatar : HTMLImageElement | null;
	myScore : HTMLDivElement | null;
	vsScore : HTMLDivElement | null;
	matchId: number | null = null;
	constructor(html: HTMLElement) {
		this.html = html;
		this.myDisplayName = this.html.querySelector<HTMLElement>("#player1-name");
		this.vsDisplayName = this.html.querySelector<HTMLElement>("#player2-name");
		this.myAvatar = this.html.querySelector<HTMLImageElement>("#player1-picture");
		this.vsAvatar = this.html.querySelector<HTMLImageElement>("#player2-picture");
		this.myScore = this.html.querySelector<HTMLDivElement>("#player1-score");
		this.vsScore = this.html.querySelector<HTMLDivElement>("#player2-score");

		if (!this.myDisplayName || !this.vsDisplayName || !this.myAvatar ||!this.vsAvatar || !this.myScore || !this.vsScore)
			return;
	}
	static new(html: HTMLElement): AppPage | null {
		return new PlayMatch(html);
	}
	async loadInto(container: HTMLElement): Promise<void> {
		const query = new URLSearchParams(location.search);
		const matchId = query.get("id");
		const matchResponse = await api.get("/api/match/" + matchId);
		if (!matchResponse || matchResponse.status != 200) {
			return history.back();
		}
		const match = matchResponse.payload;
		console.log(match);
		/*p1: { name: user1.displayName, avatar: user1.avatar, score: match.scoreP1, },
		p2: { name: user2.displayName, avatar: user2.avatar, score: match.scoreP2 },
		status: match.status,*/

		this.myDisplayName!.innerHTML = match.p1.name;
		this.vsDisplayName!.innerHTML = match.p2.name;
		this.myAvatar!.src = match.p1.avatar.startsWith("/") ? match.p1.avatar : `/${match.p1.avatar}`;
		this.vsAvatar!.src = match.p2.avatar.startsWith("/") ? match.p2.avatar : `/${match.p2.avatar}`;

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