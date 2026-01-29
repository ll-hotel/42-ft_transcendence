import { api, Status } from "./api.js";
import * as game from "./pong_client_side.js";
import { notify } from "./utils/notifs.js";

export type BaseMessage = {
	service: string,
	topic: string,
};

export type MatchMessage = BaseMessage & {
	source: string,
	match: number,
	opponent: string,
};

export type VersusMessage = BaseMessage & {
	source: string,
	content: string,
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

namespace Socket {
	export let conn: WebSocket | null = null;
	const hooks = new Map<string, ((m: Message) => void)[]>();
	// Used to reconnect on socket unwanted disconnection.
	let wasConnected = false;

	export async function connect(): Promise<boolean> {
		if (conn) {
			return true;
		} else {
			const ping = await api.get("/api/websocket/ping");
			if (!ping || ping.status == Status.unauthorized) {
				return false;
			}
		}
		conn = new WebSocket("/api/websocket");
		conn.onopen = () => console.log("[socket]", "Connected.");
		conn.onclose = (ev) => {
			console.log("[socket]", "Disconnected.");
			conn = null;
			// 4001 means server disconnected us manually.
			if (wasConnected && ev.code != 4001) {
				setTimeout(connect, 500);
			}
		};
		conn.onmessage = (event) => {
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
			send({ service: "chat", topic: "ping" }) && pingLoop();
		}, 4000);
	}
	export function isAlive() {
		return (conn && conn.readyState == WebSocket.OPEN) || false;
	}
	export function send(message: Message): boolean {
		if (isAlive() == false) {
			return false;
		}
		conn!.send(JSON.stringify(message));
		return true;
	}
	export function disconnect() {
		wasConnected = false;
		conn?.close();
	}
	export function addListener(topic: string, hook: (m: Message) => void) {
		if (!hooks.has(topic)) {
			hooks.set(topic, []);
		}
		hooks.get(topic)!.push(hook);
	}
	export function removeListener(topic: string) {
		if (hooks.has(topic)) {
			hooks.delete(topic);
		}
	}
}

export default Socket;

(window as any).socket = Socket;
