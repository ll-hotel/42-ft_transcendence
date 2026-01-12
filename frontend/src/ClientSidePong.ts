type PongClientData = | { type: 'input'; up: boolean; down: boolean } | { type: 'ping' };

/*
TODO
	1 Player Input: Event listener
	2 Player Input: Event Listener
*/

window.addEventListener("keydown", (event) => {
	if (event.key === "ArrowDown")
		sendInputData(false, true);
	if (event.key === "ArrowUp")
		sendInputData(true, false);
	if (event.key === "s")
		sendInputData(false, true);
	if (event.key === "w")
		sendInputData(true, false);
}
);

window.addEventListener("keyup", (event) => {
	if (event.key === "ArrowDown")
		sendInputData(false, false);
	if (event.key === "ArrowUp")
		sendInputData(false, false);
	if (event.key === "s")
		sendInputData(false, false);
	if (event.key === "w")
		sendInputData(false, false);
}
);

class Client {
	readonly uuid: string;
	readonly ws: WebSocket;

	constructor(ws: WebSocket) {
		this.uuid = crypto.randomUUID();
		this.ws = ws;
	}

	sendInputData(up: boolean, down: boolean) {
		this.ws.send(JSON.stringify({ type: 'input', up, down }));
	}

	//TODO revieve Game Status
}

