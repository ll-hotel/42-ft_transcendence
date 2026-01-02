namespace socket {
	export type BaseMessage = {
		source: string,
		type: string,
	};
	export type MatchMessage = BaseMessage & {
		match: number,
		opponent: string,
	};
	export type Message = BaseMessage | MatchMessage;

	let socket: WebSocket | null = null;
	const hooks = new Map<string, ((m: Message) => void)[]>();
	// Used to reconnect on socket unwanted disconnection.
	let wasConnected = false;

	export function connect() {
		socket = new WebSocket("/api/websocket");
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
}

export default socket;

