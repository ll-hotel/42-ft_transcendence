import { api, Status } from "../../api.js";

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

	private constructor(day: string, time: string,
		me: { name: string, score: number },
		opponent: { name: string, score: number }
	) {
		this.day = day;
		this.time = time;
		this.me = me;
		this.opponent = opponent;
	}

	static new(day: string, time: string,
		me: { name: string, score: number },
		opponent: { name: string, score: number }
	) {
		return new MatchInfo(day, time, me, opponent);
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
			<button name="add-friend" title="Send friend request" class="ml-auto p-2 bg-green-400 rounded-xl w-fit">+ Add</button>
		`;
		const addFriendButton = h.querySelector("button")!;
		addFriendButton.onclick = async () => {
			if (await addFriend(this.opponent.name)) {
				addFriendButton.innerText = "Sent";
				addFriendButton.onclick = null;
			}
		}
		return h;
	}
};

async function addFriend(displayName: string): Promise<boolean> {
	const res = await api.post("/api/friend/request", { displayName });
	if (!res || res.status != Status.success) {
		alert(res ? res.payload.message : "Request failed");
		return false;
	}
	return true;
}
