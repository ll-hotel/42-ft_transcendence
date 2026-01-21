import { api, Status } from "../api.js";
import { gotoPage } from "../PageLoader.js";
import { notify } from "../utils/notifs.js";
import AppPage from "./AppPage.js";

export class Tournaments implements AppPage {
	html: HTMLElement;
	private constructor(html: HTMLElement) {
		this.html = html;
	}
	static new(html: HTMLElement): AppPage | null {
		const page = new Tournaments(html);

		const createForm = html.querySelector("form") as HTMLFormElement | null;
		if (!createForm) return null;
		createForm.addEventListener("submit", (event) => {
			event.preventDefault();
			page.createTournament(createForm);
			return false;
		});

		return page;
	}
	async loadInto(container: HTMLElement): Promise<void> {
		container.appendChild(this.html);
		await this.loadTournamentList();
	}
	unload(): void {
		this.emptyTournamentList();
		this.html.remove();
	}
	emptyTournamentList() {
		const listUl = this.html.querySelector("#tournament-list") as HTMLUListElement | null;
		if (!listUl) return;
		listUl.childNodes.forEach(node => node.remove());
	}
	async createTournament(form: HTMLFormElement) {
		const formData = new FormData(form);
		const name = formData.get("tournament-name")?.toString();
		const size = formData.get("tournament-size")?.toString();
		if (!name || !size) return;
		const input = form.querySelector("[name=tournament-name]")! as HTMLInputElement;
		input.value = "";

		const rep = await api.post("/api/tournament/create", { name, size });
		if (!rep || rep.status != Status.created) {
			notify("Can not create tournament : " + rep?.payload.message, "error");
			return;
		}
		notify("Tournament [" + name + "] created", "success");
		await this.loadTournamentList();
		await this.joinTournament(name);
	}
	async loadTournamentList() {
		this.emptyTournamentList();
		const listUl = this.html.querySelector("#tournament-list") as HTMLUListElement | null;
		if (!listUl) return;

		const rep = await api.get("/api/tournament/list");
		if (!rep || rep.status != Status.success) return;
		const tournaments = rep.payload.list as {
			name: string,
			size: number,
			createdBy: string,
			playersWaiting: number,
		}[];

		if (tournaments.length == 0) {
			const cardWrapper = document.createElement("div");
			cardWrapper.innerHTML = noTournamentsCard;
			listUl.appendChild(cardWrapper.firstElementChild!);
		}

		for (const tournament of tournaments) {
			const cardWrapper = document.createElement("div");
			cardWrapper.innerHTML = tournamentCardHTML;

			const joinButton = cardWrapper.querySelector("[name=tournament-join]")! as HTMLButtonElement;
			joinButton.onclick = () => this.joinTournament(tournament.name);

			const nameCard = cardWrapper.querySelector("[name=card-name]")! as HTMLButtonElement;
			nameCard.innerText = tournament.name;

			const createdByText = cardWrapper.querySelector("[name=card-created-by]")! as HTMLElement;
			createdByText.innerText = "Created by " + tournament.createdBy;

			const playerCountText = cardWrapper.querySelector("[name=card-player-count]")! as HTMLElement;
			playerCountText.innerText = "" + tournament.playersWaiting + "/" + tournament.size;

			listUl.appendChild(cardWrapper.firstElementChild!);
		}
	}
	async joinTournament(name: string) {
		const joinRep = await api.post("/api/tournament/join", { name });
		if (!joinRep) return;
		if (joinRep.status == Status.success) {
			return gotoPage("tournament", "?name=" + name);
		}
		notify("Can not join tournament : " + joinRep.payload.message, "error");
	}
}

const noTournamentsCard = `
<div class="flex flex-col size-full italic text-center place-content-center">
	<p>No tournaments</p>
</div>`;

const tournamentCardHTML = `
<div class="grid grid-rows-2 grid-cols-3 border-b-2 border-b-[#04809f] gap-2 py-2 px-4">
	<h2 name="card-name"></h2>
	<p class="ml-auto italic text-[#04809f]">Players</p>
	<div class="row-span-2 flex">
		<button name="tournament-join"
			class="flex my-auto ml-auto size-fit p-2 gap-2 bg-[#04809f] text-white rounded-md">
			<img src="play-icon.svg" class="size-4 my-auto" />
			<p>Join</p>
		</button>
	</div>
	<p name="card-created-by" class="italic text-[#04809f]"></p>
	<p name="card-player-count" class="ml-auto"></p>
</div>`;
