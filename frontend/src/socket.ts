import { api, Status } from "./api.js";

type BaseMessage = {
	source: string,
	type: string,
};
type MatchMessage = BaseMessage & {
	match: number,
	opponent: string,
};
export type Message = BaseMessage | MatchMessage;

let socket: WebSocket | null = null;
const hooks = new Map<string, ((m: Message) => void)[]>();
// Used to reconnect on socket unwanted disconnection.
let wasConnected = false;

async function connect(): Promise<boolean> {
	if (socket) {
		return true;
	} else {
		const me = await api.get("/api/me")
		if (!me || me.status == Status.unauthorized) {
			return false;
		}
	}
	socket = new WebSocket("/api/websocket");
	socket.onopen = () => console.log("[socket]", "Connected.");
	socket.onclose = () => {
		console.log("[socket]", "Disconnected.");
		socket = null;
		if (wasConnected) {
			setTimeout(connect, 500);
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
	pingLoop();
	return true;
}
function pingLoop() {
	setTimeout(() => {
		send({source: "ping", type: "ping"}) && pingLoop();
	}, 4000);
}
function isAlive() {
	return (socket && socket.readyState == WebSocket.OPEN) || false;
}
function send(message: Message): boolean {
	if (isAlive() == false) {
		return false;
	}
	socket!.send(JSON.stringify(message));
	return true;
}
function disconnect() {
	wasConnected = false;
	socket?.close();
}
function addListener(source: string, hook: (m: Message) => void) {
	if (!hooks.has(source)) {
		hooks.set(source, []);
	}
	hooks.get(source)!.push(hook);
}
function removeListener(source: string) {
	if (hooks.has(source)) {
		hooks.delete(source);
	}
}

export default {
	connect,
	send,
	disconnect,
	addListener,
	removeListener,
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
