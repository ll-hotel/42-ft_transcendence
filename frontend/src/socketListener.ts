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
		const mess = m as  unknown as {source:string, content: string, topic : string};
		const isMatch = confirm(`New invitation to play with ${mess.content}, let's win ?`);
		socket.send({source : "server", topic : isMatch ? "vs:accept" : "vs:decline", content: mess.source})
	});

	socket.addListener("vs:start", (m) => {
		const mess = m as  unknown as {match:number, opponent: string};
		notify(`You're going to play against ${mess.opponent} in 3 seconds !`, "success");
		setTimeout( () => {
			gotoPage("play/match", `?id=${mess.match}`)
		}, 3000);
	});

	socket.addListener("vs:decline", (m:Message) => {
		const mess = m as  unknown as {source: string};
		notify(`${mess.source} didn't what to play with you :(`, "error");
	});

	socket.addListener("match", (m) => {
		const match = m as unknown as { id?: number };
		notify("Match found: id=" + match.id!, "info");
		gotoPage("play/", "?id=" + match.id!);
	})

	socket.addListener("vs:error", (m:Message) => {
		const mess = m as unknown as {content: string };
		notify (`${mess.content}`, "error");
	})
}


