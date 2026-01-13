import { api, Status } from "../../api.js";
import { gotoPage, gotoUserPage } from "../../PageLoader.js";

export class MatchInfo {
	day: string;
	time: string;
	me: {
		name: string;
		score: number;
	};
	opponent: {
		name: string;
		score: number;
	};
	connectedUserName : string;

	private constructor(day: string, time: string,
		me: { name: string, score: number },
		opponent: { name: string, score: number },
		connectedUserName : string
	) {
		this.day = day;
		this.time = time;
		this.me = me;
		this.opponent = opponent;
		this.connectedUserName = connectedUserName;
	}

	static new(day: string, time: string,
		me: { name: string, score: number },
		opponent: { name: string, score: number },
		connectedUserName : string
	) {
		return new MatchInfo(day, time, me, opponent, connectedUserName);
	}

	toHTML(): HTMLElement {
		const h = document.createElement("div");
		h.className = "grid grid-cols-5 place-content-evenly items-center text-center rounded-2xl p-2 min-w-fit";
		if (this.me.score >= this.opponent.score) {
			h.className += " bg-green-100";
		} else {
			h.className += " bg-red-100"
		}
		h.innerHTML = `
			<div name="date" class="grid grid-cols-1 grid-rows-2 text-sm">
				<p class="overflow-auto">${this.day}</p>
				<p>${this.time}</p>
			</div>
			<p name="me">${this.me.name}</p>
			<p name="score">${this.me.score} - ${this.opponent.score}</p>
			<p name="opponent">${this.opponent.name}</p>
			<button name="go-to" title="Send friend request" class="ml-auto p-2 bg-[#04809F] text-white rounded-xl w-fit">See</button>
		`;
		const goToButton = h.querySelector("button")!;
		goToButton.onclick = async () => {
			if (this.connectedUserName == this.opponent.name)
				await gotoPage("profile");
			else
				await gotoUserPage(this.opponent.name);
		}
		return h;
	}
	static noMatchHtml() : HTMLElement {
		const h = document.createElement("div");
		h.className = "grid grid-cols-1 bg-white place-content-evenly items-center text-center rounded-2xl p-2 min-w-fit";
		h.innerHTML = `
			<p name = "me" >There is no match...</p>
		`;
		return h;
	}
};
