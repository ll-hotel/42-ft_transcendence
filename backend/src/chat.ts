namespace Chat {
	type Message = {
		source: string,
		target: string,
		content: string,
	};

	class Connection {
		ws: WebSocket;
		incoming: Message[];

		private constructor(ws: WebSocket) {
			this.ws = ws;
			this.incoming = [];
			ws.addEventListener("message", (event: MessageEvent<string>) => {
				const msg = parseJson<Message>(event.data);
				if (msg) {
					this.incoming.push(msg);
				}
			});
		}
		static new(ws: WebSocket) {
			return new Connection(ws);
		}
		sendRaw(data: string) {
			this.ws.send(data);
		}
		messages() {
			const msgs = this.incoming;
			this.incoming = [];
			return msgs;
		}
	}

	function parseJson<T>(text: string): T | null {
		let obj: T;
		try {
			obj = JSON.parse(text);
		} catch (error) {
			console.log(JSON.stringify({ origin: "parseJSON", text: error }))
			return null;
		}
		return obj;
	}

	export class Instance {
		users: Map<string, User>;
		rooms: Map<string, Room>;

		constructor() {
			this.users = new Map();
			this.rooms = new Map();
			setInterval(async () => await this.flush(), 200);
			setInterval(() => this.users.forEach(user => user.send(
				{ source: user.id.slice(1), target: "", content: "", }
			)), 2000);
		}
		async flush() {
			const promises: Promise<void>[] = [];
			for (const [_, user] of this.users) {
				promises.push(user.flush());
			}
			for (const promise of promises) {
				await promise;
			}
		}
		createUser(username: string, ws: WebSocket): boolean {
			const chatUser = Chat.User.new(username, ws, this);
			if (!chatUser) {
				return false;
			}
			this.users.set(chatUser.id, chatUser);
			chatUser.send({ source: username, target: "", content: ""});
			return true;
		}
		createRoom(id: string): boolean {
			if (this.rooms.has("#" + id)) {
				return false;
			}
			const room = Room.new(id);
			if (!room) {
				return false;
			}
			this.rooms.set(room.id, room);
			return true;
		}
	};

	export class User {
		id: string;
		conn: Connection;
		chat: Instance;

		private constructor(username: string, ws: WebSocket, chat: Instance) {
			this.id = username;
			this.conn = Connection.new(ws);
			this.chat = chat;
		}
		static new(username: string, ws: WebSocket, chat: Instance) {
			if (/(?:[a-zA-Z].*)\w.*/.test(username) == false || ws.readyState == ws.CLOSED) {
				return null;
			}
			const userId = "@" + username;
			if (chat.users.has(userId)) {
				return null;
			}
			ws.addEventListener("close", () => {
				for (const [_, room] of chat.rooms) {
					room.disconnect(userId);
				}
				chat.users.delete(userId);
			});
			return new User(userId, ws, chat);
		}
		send(message: Message) {
			this.conn.sendRaw(JSON.stringify(message));
		}
		async flush() {
			for (const message of this.conn.messages()) {
				console.log({ message });
				if (message.target[0] == "#") {
					this.chat.rooms.get(message.target)?.send(message);
				} else if (message.target[0] == "@") {
					this.chat.users.get(message.target)?.send(message);
				}
			}
		}
	};

	export class Room {
		id: string;
		users: User[];

		private constructor(id: string) {
			this.id = id;
			this.users = [];
		}
		static new(id: string) {
			if (/\w+/.test(id) == false) {
				return null;
			}
			return new Room("#" + id);
		}
		send(message: Message) {
			if (message.target != this.id) {
				return;
			}
			for (const user of this.users) {
				user.send(message);
			}
		}
		connect(user: User) {
			if (this.users.find(o => o.id == user.id)) {
				// User already joined.
				return;
			}
			this.users.push(user);
			this.send({ source: user.id, target: this.id, content: "Joined" });
		}
		disconnect(id: string) {
			const pos = this.users.findIndex(o => o.id == id);
			if (pos >= 0) {
				this.users.splice(pos, 1);
			}
			console.log({ room: this.id, message: `Disconnected ${id}` });
		}
	};
};

export default Chat;
