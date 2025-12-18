type PongClientData = | { type: 'input'; up: boolean; down: boolean } | { type: 'ping' };

function sendInputData(up: boolean, down: boolean) {
	console.log(JSON.stringify({ type: 'input', up, down }));
}

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
	socket: WebSocket;

	constructor() {
		this.uuid = crypto.randomUUID();
		this.socket = new WebSocket('localhost:8443/pong');
	}
};

