import { tcheckFriends } from "./user/friend";

function privateRoomId(UserAId: string, UserBId: string): string {
	const [a, b] = UserAId < UserBId ? [UserAId, UserBId] : [UserBId, UserAId];
	return `#private:${a}:${b}`;
}

namespace Chat {
	export type Message = {
		source: string;
		target: string;
		content: string;
	};

	export class Connection {
	ws: WebSocket;
	incoming: Chat.Message[];

	constructor(ws: WebSocket) {
		this.ws = ws;
		this.incoming = [];

		ws.addEventListener("message", (event) => {
			try {
				const msg = JSON.parse(event.data.toString());
				this.incoming.push(msg);
			} catch {
				// ignore invalid
			}
		});
	}

	popMessages(): Chat.Message[] {
		const msgs = this.incoming;
		this.incoming = [];
		return msgs;
	}
}


	export class User {
		id: string;
		userId: number;
		connections: Set<Connection>;
		rooms: Set<string>;
		buffer: Message[];
		buffMax : number;

		constructor(userId: number, username: string) {
			this.userId = userId;
			this.id = "@" + username;
			this.connections = new Set();
			this.rooms = new Set();
			this.buffer = [];
			this.buffMax= 100
		}

		connect(ws: WebSocket) {
			const conn = new Connection(ws);
			this.connections.add(conn);
			this.flushBuffer();

			ws.addEventListener("close", () => 
			{
				this.connections.delete(conn);
			})
		}

		disconnect() {
			for (const conn of this.connections)
			{
				if (conn.ws.readyState == WebSocket.OPEN)
					conn.ws.close();
			}
			this.connections.clear();
			this.buffer = [];
		}

		send(message: Message) {
			if (this.connections.size > 0)
			{
				for (const conn of this.connections)
				{
					if (conn.ws && conn.ws.readyState === WebSocket.OPEN)
						conn.ws.send(JSON.stringify(message));
				}
			}
			else {
				if (this.buffer.length >= this.buffMax)
					this.buffer.shift();
				this.buffer.push(message);
			}
		}

		flushBuffer() {
			if (this.connections.size === 0)
				return;
			for (const conn of this.connections) 
				if (conn.ws && conn.ws.readyState === WebSocket.OPEN)
					for (const msg of this.buffer)
						conn.ws.send(JSON.stringify(msg));
			this.buffer = [];
		}

		flushIncoming(chat: Instance) {
			for (const conn of this.connections) {
				const messages = conn.popMessages();
				for (const msg of messages) {

					// message vers room
					if (msg.target.startsWith("#"))
					{
						const room = chat.rooms.get(msg.target);
						if (room) 
							room.send(msg);
						continue;
					}

				/*	// message privé
					if (msg.target.startsWith("@")) {
						const target = chat.users.get(msg.target);
						if (!target) continue;
						try {
							const room = await chat.createPrivateRoom(this, target);
							room.send(msg);
						}
						catch {};
					}*/
				}
			}
		}

	}

	export class Room {
		id: string;
		users: User[];
		
		private constructor(id: string) {
			this.id = id;
			this.users = [];
		}

		static new(id: string) {
			return new Room("#" + id);
		}

		connect(user: User) {
			if (!this.users.find(u => u.id === user.id)) {
				this.users.push(user);
				this.send({ source: user.id, target: this.id, content: "Joined" });
				user.rooms.add(this.id);
				user.flushBuffer();
			}
		}

		disconnect(userId: string) {
			this.users = this.users.filter(u => u.id !== userId);
		}

		send(message: Message) {
			for (const user of this.users) {
				user.send({ ...message, target: this.id });
			}
		}

		flush() {
			for (const user of this.users) {
				user.flushBuffer();
			}
		}
	}


	export class Instance {
		users: Map<string, User>; // tous les users connus
		rooms: Map<string, Room>;

		constructor() {
			this.users = new Map();
			this.rooms = new Map();
			setInterval(() => this.flush(), 50)
		}

		flush() {
			for (const user of this.users.values()) {
				user.flushIncoming(this);
			}
			for (const room of this.rooms.values()) {
				room.flush();
			}
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
			if (this.rooms.has("#" + id))
				return false;
			const room = Room.new(id);
			this.rooms.set(room.id, room);
			return true;
		}

		async createPrivateRoom(userA: User, userB: User): Promise<Room> {
			const areFriends = await tcheckFriends(userA.userId, userB.userId);
			if (!areFriends)
				throw new Error("Cannot create private room: not friends");

			const id = privateRoomId(userA.id, userB.id);
			let room = this.rooms.get(id);
			if (!room) {
				room = Room.new(id.slice(1))!;
				this.rooms.set(room.id, room);
			}
			room.connect(userA);
			room.connect(userB);
			return room;
		}

		async newWebsocketConnection(ws: WebSocket, req: any) {
			const userInfo = req.user!;
			const user = this.getOrCreateUser(userInfo.id, userInfo.username);
			user.connect(ws);

			for (const other of this.users.values()) {
				if (other === user)
					continue;
				try {
					await this.createPrivateRoom(user, other);
				}
				catch {}
			}

			// Rejoin rooms existantes
			for (const roomId of user.rooms) {
				const room = this.rooms.get(roomId);
				if (room) room.connect(user);
			}

			ws.addEventListener("close", () => {
				if (user.connections.size === 0) {
					for (const roomId of user.rooms) {
						const room = this.rooms.get(roomId);
						room?.disconnect(user.id);
						if (room?.users.length === 0)
							this.rooms.delete(room.id);
					}
					user.rooms.clear();
				}
			});
		}
	}
}

export default Chat;
