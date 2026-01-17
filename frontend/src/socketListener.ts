import socket from "./socket.js"
import { Message } from "./socket.js";
import { gotoPage } from "./PageLoader.js";
let isSocket = false; 

export async function initSocket() {
	if (isSocket)
		return;
	isSocket = true;

	socket.addListener("vs:invite", (m: Message) => {
		const isMatch = confirm(`New invitation to play with ${m.source}, let's win ?`);
		socket.send({source : "server", topic : isMatch ? "vs:accept" : "vs:decline", target: m.source})
	});

	socket.addListener("vs:start", (m: Message) => {
		console.log(`play match n°${m.match} within ${m.opponent}`);
		gotoPage("play/match", `?id=${m.match}`);
	});

	socket.addListener("vs:decline", (m:Message) => {
		alert(`${m.source} didn't what to play with you :(`);
	});
}


