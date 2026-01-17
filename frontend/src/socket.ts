import { api, Status } from "./api.js";

type BaseMessage = {
	source: string,
	type: string,
};
type MatchMessage = BaseMessage & {
	match: number,
	opponent: string,
};

type VersusMessage = BaseMessage & {
	target: string;
};
export type Message = BaseMessage | MatchMessage | VersusMessage;

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
	socket.onclose = (ev) => {
		console.log("[socket]", "Disconnected.");
		socket = null;
		// 4001 means server disconnected us manually.
		if (wasConnected && ev.code != 4001) {
			setTimeout(connect, 500);
		}
	};

// HOOK MAINTENANT LIER AU TYPE PLUTOT QUE A LA SOURCE 
	socket.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data) as Message;
			if (hooks.has(message.type)) {
				hooks.get(message.type)!.forEach(hook => hook(message));
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

//Changer le listener en fonction du type plutot que de la source, (si source est une personne alors aucun sens, plutot lier a un type de message dans le cas d'une invit,
//plusieur source possible (source = clientId du sender ou alors (source = server et ajouter une variable sender)) )

function addListener(type: string, hook: (m: Message) => void) {
	if (!hooks.has(type)) {
		hooks.set(type, []);
	}
	hooks.get(type)!.push(hook);
}

function removeListener(type: string) {
	if (hooks.has(type)) {
		hooks.delete(type);
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
