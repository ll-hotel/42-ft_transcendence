import { api, Status } from "./api";
// import socket, status, { Message } from "./socket";
import AppPage from "./pages/AppPage"

type PongClientData = | { type: 'input'; up: boolean; down: boolean } | { type: 'ping' };

/*
TODO
	1 Player Input: Event listener
	2 Player Input: Event Listener
*/

// window.addEventListener("keydown", (event) => {
// 	if (event.key === "ArrowDown")
// 		sendInputData(false, true);
// 	if (event.key === "ArrowUp")
// 		sendInputData(true, false);
// 	if (event.key === "s")
// 		sendInputData(false, true);
// 	if (event.key === "w")
// 		sendInputData(true, false);
// }
// );
//
// window.addEventListener("keyup", (event) => {
// 	if (event.key === "ArrowDown")
// 		sendInputData(false, false);
// 	if (event.key === "ArrowUp")
// 		sendInputData(false, false);
// 	if (event.key === "s")
// 		sendInputData(false, false);
// 	if (event.key === "w")
// 		sendInputData(false, false);
// }
// );

class Client {
	readonly uuid: string;
	readonly ws: WebSocket;

	constructor(ws: WebSocket) {
		this.uuid = crypto.randomUUID();

		// We will be notified on our websocket, so do not forget to set a listener.
// I set it BEFORE making the request to join the Queue to not miss the
// "match found" notification.
// 		socket.addListener("matchmaking", (message) => {
// 			if (message.type == "found") {
// 				const match = message.match;
// 				const opponentName = message.opponent;
// 				// IDK, join match?
// 			}
// 		});
// 		const join = api.post("/api/matchmaking/join");
// 		if (!join || join.status != Status.success) {
// 			// error. maybe remove the listener too.
// 			socket.removeListener("matchmaking");
// 		} else {
// 			// Yay!
// 		}
// 		}
	}

	// sendInputData(up: boolean, down: boolean) {
	// 	this.ws.send(JSON.stringify({ type: 'input', up, down }));
	// }

	//TODO receive Game Status
}

