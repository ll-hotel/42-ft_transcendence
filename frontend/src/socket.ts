type BaseMessage = {
	source: string,
	type: string,
};
type MatchMessage = BaseMessage & {
	match: number,
	opponent: string,
};
type Message = BaseMessage | MatchMessage;

let socket: WebSocket | null = null;
const hooks = new Map<string, ((m: Message) => void)[]>();
// Used to reconnect on socket unwanted disconnection.
let wasConnected = false;
let pingInterval: number | null = null;

export function connect() {
	socket = new WebSocket("/api/websocket");
	socket.onopen = () => console.log("[socket] Connection established.");
	socket.onclose = () => {
		socket = null;
		if (wasConnected) {
			connect();
		}
	};
	socket.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data) as Message;
			if (hooks.has(message.source)) {
				hooks.get(message.source)!.forEach(hook => hook(message));
			}
		} catch (err) {
			console.log(err);
		}
	}
	wasConnected = true;
	if (!pingInterval) {
		pingInterval = setInterval(pingIntervalHook, 4000);
	}
}
function pingIntervalHook() {
	if (socket) {
		socket.send("");
	}
}
export function isAlive() {
	return (socket && socket.readyState == WebSocket.OPEN) || false;
}
export function send(message: Message) {
	if (isAlive()) {
		socket!.send(JSON.stringify(message));
	}
}
export function disconnect() {
	wasConnected = false;
	socket?.close();
}
export function addListener(source: string, hook: (m: Message) => void) {
	if (!hooks.has(source)) {
		hooks.set(source, []);
	} else {
		hooks.get(source)!.push(hook);
	}
}

export default {
	connect,
	send,
	disconnect,
	addListener,
};

// For development purposes.
// TODO: remove.
(window as any).socket = {
	connect,
	isAlive,
	send,
	disconnect,
	addListener,
};
