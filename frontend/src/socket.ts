import { api, Status } from "./api.js";
import * as game from "./pong_client_side.js";
import { notify } from "./utils/notifs.js";

export interface BaseMessage {
	service: string;
	topic: string;
}

export interface ErrorMessage extends BaseMessage {
	error: string;
}

export interface MatchMessage extends BaseMessage {
	source: string;
	match: number;
	opponent: string;
}

export interface VersusMessage extends BaseMessage {
	source: string;
	content: string;
}

export interface ChatMessage extends BaseMessage {
	source: string;
	target: string;
	content: string;
}

export interface StateMessage extends BaseMessage {
	type: "state";
	ball: {
		x: number,
		y: number,
		speed: game.Vector2D,
	};
	paddles: {
		p1_Y: number,
		p1_input: { up: boolean, down: boolean },
		p2_Y: number,
		p2_input: { up: boolean, down: boolean },
	};
	score: { p1: number, p2: number };
	status: game.PongStatus;
	side: game.Side;
}

export interface InputMessage extends BaseMessage {
	type: "input";
	up: boolean;
	down: boolean;
}

export interface ScoreMessage extends BaseMessage {
	type: "score";
	p1_score: number;
	p2_score: number;
}

export interface LocalMessage extends BaseMessage {
	type: "input";
	p1_up: boolean;
	p1_down: boolean;
	p2_up: boolean;
	p2_down: boolean;
}

export type PongMessage = InputMessage | ScoreMessage | LocalMessage | StateMessage;
export type Message = VersusMessage | BaseMessage | MatchMessage | PongMessage | ChatMessage;

namespace Socket {
	export let conn: WebSocket | null = null;
	const hooks = new Map<string, ((m: Message) => void)[]>();
	// Used to reconnect on socket unwanted disconnection.
	let reconnection: number | null = null;

	export async function connect(): Promise<boolean> {
		if (conn && conn.readyState == conn.OPEN) {
			return true;
		} else {
			const ping = await api.get("/api/websocket/ping");
			if (!ping || ping.status == Status.unauthorized) {
				return false;
			}
		}
		const promise = new Promise<WebSocket | null>(resolve => {
			const tmp = new WebSocket("/api/websocket");
			tmp.onerror = () => resolve(null);
			tmp.addEventListener("open", () => {
				if (reconnection) {
					notify("Reconnected", "success", 1000);
					clearInterval(reconnection);
				} else {
					notify("Connected", "success", 1000);
				}
				reconnection = null;
				tmp.onerror = null;
				resolve(tmp);
			});
		});
		conn = await promise;
		if (!conn) {
			return false;
		}
		conn.addEventListener("close", (ev) => {
			conn = null;
			if (!reconnection && ev.code != 1005) {
				notify("Disconnected. Reconnecting...", "info", 500);
				reconnection = setInterval(connect, 1000);
			}
		});
		conn.addEventListener("message", (event) => {
			try {
				const message = JSON.parse(event.data) as Message;
				if (hooks.has(message.topic)) {
					hooks.get(message.topic)!.forEach(hook => hook(message));
				}
			} catch {}
		});
		pingLoop();
		addListener("error", (data) => {
			const { error } = data as unknown as { error: string };
			notify(error, "error");
		});
		return true;
	}
	let pingInterval: number | null = null;
	function pingLoop() {
		if (pingInterval != null) {
			return;
		}
		pingInterval = setInterval(() => {
			send({ service: "chat", topic: "ping" });
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
	export function disconnect(): Promise<void> {
		return new Promise((resolve) => {
			if (conn == null) {
				return resolve();
			}
			conn.addEventListener("close", () => resolve());
			conn.close();
		});
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
