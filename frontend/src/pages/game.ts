import AppPage from "./AppPage.js";
import socket from "../socket.js";

export class GamePage implements AppPage {
	loadInto(container: HTMLElement): void {
		socket.connect();
	}
	unload(): void {
		throw new Error("Method not implemented.");
	}
}
