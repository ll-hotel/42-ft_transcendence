import socket from "./socket.js"
import { Message } from "./socket.js";
import { gotoPage } from "./PageLoader.js";
import { notify } from "./pages/utils/notifs.js";
let isSocket = false; 

export async function initSocket() {
	if (isSocket)
		return;
	isSocket = true;

	socket.addListener("vs:invite", (m:Message) => {
		const mess = m as  unknown as {source:string, target: string, topic : string};
		const isMatch = confirm(`New invitation to play with ${mess.source}, let's win ?`);
		socket.send({source : "server", topic : isMatch ? "vs:accept" : "vs:decline", target: mess.source})
	});

	socket.addListener("vs:start", (m) => {
		const mess = m as  unknown as {match:number, opponent: string};
		console.log(`play match n°${mess.match} within ${mess.opponent}`);
		gotoPage("play/match", `?id=${mess.match}`);
	});

	socket.addListener("vs:decline", (m:Message) => {
		const mess = m as  unknown as {source: string};
		notify(`${mess.source} didn't what to play with you :(`, "error");
	});

	socket.addListener("match", (m) => {
		const match = m as unknown as { id?: number };
		// TODO: gotoPage("match", "?id=" + message.id!);
		notify("Match found: id=" + match.id!, "success")
	})
}


