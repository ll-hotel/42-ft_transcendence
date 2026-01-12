import { tcheckFriends } from "./user/friend";
import user from "./user/user";

function privateRoomId(UserAId: string, UserBId: string): string {
	const [a, b] = UserAId < UserBId ? [UserAId, UserBId] : [UserBId, UserAId];
	return `private:${a}:${b}`;
}

namespace Chat {
	export type Message = {
		source: string;
		target: string;
		content: string;
		system?: boolean;
	};

	export class Connection {
	ws: WebSocket;
	user : User;
	chat : Instance;

	constructor(ws: WebSocket, user : User, chat: Instance) {
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
		})
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

		connect(ws: WebSocket, chat: Instance) {
			const conn = new Connection(ws, this, chat);
			this.connections.add(conn);
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

/*		flushIncoming(chat: Instance) {
			for (const conn of this.connections) {
				const messages = conn.popMessages();
				for (const msg of messages) {
					if (!this.rooms.has(msg.target))
						continue;
					const room = chat.rooms.get(msg.target);
					if (!room || !room.users.has(this))
						continue;

					const allmsg: Message = {
						source : this.id,
						target: msg.target,
						content:msg.content
					};

					room.send(allmsg);
					continue;

				/*	// message privé
					if (msg.target.startsWith("@")) {
						const target = chat.users.get(msg.target);
						if (!target) continue;
						try {
							const room = await chat.createPrivateRoom(this, target);
							room.send(msg);
						}
						catch {};
					}
				}
			}
		} */

	}

	export class Room {
		id: string;
		users: Set<User>;
		messages: Message[];
		messMax : number
		
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
			if (!this.users.has(user))
				{
				this.users.add(user);
				this.send({ source: user.id, target: this.id, content: "Joined", system: true });
				user.rooms.add(this.id);
			}
		}

		disconnect(userId: string) {
			this.send({source: userId, target : this.id, content : "Disconnect", system: true});
			for (const user of this.users)
			{
				if (user.id === userId)
				{
					this.users.delete(user);
					break;
				}
			}
		}

		send(message: Message) {
			if (!message.system)
			{
				this.messages.push(message);
				if (this.messages.length > this.messMax)
					this.messages.shift();
			}

			for (const user of this.users)
				user.send({ ...message, target: this.id });
		}
	}


	export class Instance {
		users: Map<string, User>; // tous les users connus
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
			if (this.rooms.has(id))
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
			if (!room)
			{
				room = Room.new(id)!;
				this.rooms.set(room.id, room);
			}
			room.connect(userA);
			room.connect(userB);
			return room;
		}

		async newWebsocketConnection(ws: WebSocket, req: any) {
			const userInfo = req.user!;
			const user = this.getOrCreateUser(userInfo.id, userInfo.username);
			user.connect(ws, this);

			// Rejoin rooms existantes
			for (const roomId of user.rooms)
			{
				const room = this.rooms.get(roomId);
				if (room) room.connect(user);
			}

			user.flushBuffer();

			ws.addEventListener("close", () => {
				if (user.connections.size === 0) {
					for (const roomId of user.rooms) {
						const room = this.rooms.get(roomId);
						room?.disconnect(user.id);
						if (room && room.users.size === 0)
							this.rooms.delete(room.id);
					}
					user.rooms.clear();
				}
			});
		}

		handleMessage(sender: User, message : any)
		{
			if (!message || typeof message !== "object")
				return;

			const {target, content} = message;

			if (!target || typeof content !== "string")
				return;

			const room = this.rooms.get(target);

			if (!room)
				return;

			if (!room.users.has(sender))
				return;

			const finalMess: Message = {
				source: sender.id,
				target: room.id,
				content,
			}

			room.send(finalMess);
		}
	}
}

export default Chat;
