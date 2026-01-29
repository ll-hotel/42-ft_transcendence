import { api, Status } from "./api.js";
import * as game from "./pong_client_side.js";

export type BaseMessage = {
	service : string,
	topic: string,
};

export type MatchMessage = BaseMessage & {
	source: string,
	match: number,
	opponent: string,
};

export type VersusMessage = BaseMessage & {
	source: string,
	content: string;
};

export type StateMessage = BaseMessage & {
	type: "state",
	ball: {
		x: number,
		y: number,
		speed: game.Vector2D,
	},
	paddles: {
		p1_Y: number,
		p1_input: { up: boolean, down: boolean },
		p2_Y: number,
		p2_input: { up: boolean, down: boolean },
	},
	score: { p1: number, p2: number },
	status: game.PongStatus,
};

export type InputMessage = BaseMessage & {
	type: "input",
	up: boolean,
	down: boolean,
};

export type ScoreMessage = BaseMessage & {
	type: "score",
	p1_score: number,
	p2_score: number,
};

export type LocalMessage = BaseMessage & {
	type: "input",
	p1_up: boolean,
	p1_down: boolean,
	p2_up: boolean,
	p2_down: boolean,
};

export type PongMessage = InputMessage | ScoreMessage | LocalMessage | StateMessage;
export type Message = VersusMessage | BaseMessage | MatchMessage | PongMessage;

let socket: WebSocket | null = null;
const hooks = new Map<string, ((m: Message) => void)[]>();
// Used to reconnect on socket unwanted disconnection.
let wasConnected = false;

async function connect(): Promise<boolean> {
	if (socket) {
		return true;
	} else {
		const me = await api.get("/api/websocket/ping");
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
	socket.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data) as Message;
			if (hooks.has(message.topic)) {
				hooks.get(message.topic)!.forEach(hook => hook(message));
			}
		} catch (err) {
			console.log(err);
		}
	};
	wasConnected = true;
	pingLoop();
	return true;
}
function pingLoop() {
	setTimeout(() => {
		send({  service:"chat",topic: "ping" }) && pingLoop();
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
function addListener(topic: string, hook: (m: Message) => void) {
	if (!hooks.has(topic)) {
		hooks.set(topic, []);
	}
	hooks.get(topic)!.push(hook);
}
function removeListener(topic: string) {
	if (hooks.has(topic)) {
		hooks.delete(topic);
	}
}

export default {
	connect,
	send,
	isAlive,
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
