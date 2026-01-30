import { FastifyRequest } from "fastify";
import * as Ws from "ws";
import * as db from "./utils/db/methods";

function privateRoomId(UserAId: string, UserBId: string): string {
	const [a, b] = UserAId < UserBId ? [UserAId, UserBId] : [UserBId, UserAId];
	return `private:${a}:${b}`;
}

namespace Chat {
	export type Message = {
		topic: "chat",
		source: string,
		target: string,
		content: string,
		system?: boolean,
	};

	export class Connection {
		ws: Ws.WebSocket;
		user: User;
		chat: Instance;

		constructor(ws: Ws.WebSocket, user: User, chat: Instance) {
			this.ws = ws;
			this.user = user;
			this.chat = chat;

			ws.addEventListener("message", (event) => {
				try {
					const msg = JSON.parse(event.data.toString());
					this.chat.handleMessage(this.user, msg);
				} catch {
				}
			});

			ws.addEventListener("close", () => {
				user.connections.delete(this);
			});
		}
	}

	export class User {
		id: string;
		userId: number;
		connections: Set<Connection>;
		rooms: Set<string>;
		buffer: Message[];
		buffMax: number;

		constructor(userId: number, username: string) {
			this.userId = userId;
			this.id = "@" + username;
			this.connections = new Set();
			this.rooms = new Set();
			this.buffer = [];
			this.buffMax = 100;
		}

		connect(ws: Ws.WebSocket, chat: Instance) {
			const conn = new Connection(ws, this, chat);
			this.connections.add(conn);
		}

		disconnect() {
			for (const conn of this.connections) {
				if (conn.ws.readyState == Ws.WebSocket.OPEN) {
					conn.ws.close();
				}
			}
			this.connections.clear();
			this.buffer = [];
		}

		send(message: Message) {
			if (this.connections.size > 0) {
				for (const conn of this.connections) {
					if (conn.ws && conn.ws.readyState === Ws.WebSocket.OPEN) {
						conn.ws.send(JSON.stringify(message));
					}
				}
			} else {
				if (this.buffer.length >= this.buffMax) {
					this.buffer.shift();
				}
				this.buffer.push(message);
			}
		}

		flushBuffer() {
			if (this.connections.size === 0) {
				return;
			}
			for (const conn of this.connections) {
				if (conn.ws && conn.ws.readyState === Ws.WebSocket.OPEN) {
					for (const msg of this.buffer) {
						conn.ws.send(JSON.stringify(msg));
					}
				}
			}
			this.buffer = [];
		}
	}

	export class Room {
		id: string;
		users: Set<User>;
		messages: Message[];
		messMax: number;

		private constructor(id: string) {
			this.id = id;
			this.users = new Set();
			this.messages = [];
			this.messMax = 500;
		}

		static new(id: string) {
			return new Room(id);
		}

		connect(user: User) {
			if (!this.users.has(user)) {
				this.users.add(user);
				this.send({ topic: "chat", source: user.id, target: this.id, content: "Joined room", system: true });
				user.rooms.add(this.id);
			}
		}

		disconnect(userId: string) {
			this.send({ topic: "chat", source: userId, target: this.id, content: "Left Room", system: true });
			for (const user of this.users) {
				if (user.id === userId) {
					this.users.delete(user);
					break;
				}
			}
		}

		send(message: Message) {
			if (!message.system) {
				this.messages.push(message);
				if (this.messages.length > this.messMax) {
					this.messages.shift();
				}
			}
			const senderId = message.source;
			const senderUser = db.userIdByUsername.get({ username: senderId.slice(1) });
			if (!senderUser) {
				return;
			}
			for (const chatUser of this.users) {
				const otherUser = db.userIdByUsername.get({ username: chatUser.id.slice(1) });
				if (!otherUser) continue;
				const isBlocked = db.userBlocked.get({ userId: senderUser.id, otherId: otherUser.id });
				if (!isBlocked) {
					chatUser.send({ ...message, target: this.id });
				}
			}
		}
	}

	export class Instance {
		users: Map<string, User>;
		rooms: Map<string, Room>;

		constructor() {
			this.users = new Map();
			this.rooms = new Map();
		}

		getOrCreateUser(userId: number, username: string): User {
			const key = "@" + username;
			let user = this.users.get(key);
			if (!user) {
				user = new User(userId, username);
				this.users.set(key, user);
			}
			return user;
		}

		createRoom(id: string): boolean {
			if (this.rooms.has(id)) {
				return false;
			}
			const room = Room.new(id);
			this.rooms.set(room.id, room);
			return true;
		}

		async createPrivateRoom(userA: User, userB: User): Promise<Room> {
			if (userA.userId == userB.userId) {
				throw new Error("You can not talk to yourself");
			}
			// const friends = await areFriends(userA.userId, userB.userId);
			// if (!friends) {
			// 	throw new Error("Cannot create private room: not friends");
			// }

			const id = privateRoomId(userA.id, userB.id);
			let room = this.rooms.get(id);
			if (!room) {
				room = Room.new(id)!;
				this.rooms.set(room.id, room);
			}
			room.connect(userA);
			room.connect(userB);
			return room;
		}

		async newWebsocketConnection(ws: Ws.WebSocket, req: FastifyRequest) {
			const userInfo = req.user!;
			const user = this.getOrCreateUser(userInfo.id, userInfo.username);
			user.connect(ws, this);
			
			for (const roomId of user.rooms) {
				const room = this.rooms.get(roomId);
				if (room) room.connect(user);
			}

			user.flushBuffer();

			ws.addEventListener("close", () => {
				if (user.connections.size === 0) {
					for (const roomId of user.rooms) {
						const room = this.rooms.get(roomId);
						room?.disconnect(user.id);
						if (room && room.users.size === 0) {
							this.rooms.delete(room.id);
						}
					}
					user.rooms.clear();
				}
			});
		}

		handleMessage(sender: User, message: unknown) {
			console.log(message);
			if (!message || typeof message !== "object") {
				return;
			}
			const { target, content } = message as Message;
			if (!target || typeof content !== "string") {
				return;
			}
			if (!this.rooms.has(target)) {
				return;
			}
			const room = this.rooms.get(target)!;
			if (!room.users.has(sender)) {
				return;
			}
			const finalMess: Message = {
				topic: "chat",
				source: sender.id,
				target: room.id,
				content,
			};
			room.send(finalMess);
		}
	}
}

export default Chat;
export const chat = new Chat.Instance();
