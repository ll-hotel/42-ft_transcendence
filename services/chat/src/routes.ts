import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { chat, splitRoomName } from "./chat";
import { userIdByUsername } from "./utils/db/methods";
import { STATUS } from "./utils/http-reply";
import { authGuard } from "./utils/security/authGuard";

export function chatRoute(fastify: FastifyInstance) {
	fastify.get("/api/chat/ping", { preHandler: authGuard }, (_req, rep) => {
		rep.code(STATUS.success).send({ message: "pong" });
	});

	fastify.post(
		"/api/chat/connect",
		{ preHandler: authGuard },
		(req, rep) => {
			const user = req.user!;
			if (chat.users.has("@" + user.username)) {
				rep.code(STATUS.bad_request).send({ message: "Already connected" });
			} else {
				rep.code(STATUS.success).send({});
			}
		},
	);

	fastify.get("/api/chat/room/:id", { preHandler: authGuard }, (req: FastifyRequest, rep: FastifyReply) => {
		const _me = chat.getOrCreateUser(req.user!.id, req.user!.username);
		const roomId = (req.params as { id: string }).id;
		if (roomId.length == 1 || !chat.rooms.has(roomId)) {
			return rep.code(STATUS.not_found).send({ message: "Room not found" });
		}
		const room = chat.rooms.get(roomId)!;
		return rep.code(STATUS.success).send({ roomId: room.id });
	});

	fastify.get("/api/chat/rooms", { preHandler: authGuard }, (req, rep) => {
		const roomsNames: string[] = [];
		for (const [name, _room] of chat.rooms) {
			roomsNames.push(name);
		}
		const rooms = roomsNames.map((name) => {
			const { user1, user2 } = splitRoomName(name);
			return user1 == req.user!.username ? user2 : user1;
		});
		rep.code(STATUS.success).send({ rooms });
	});

	fastify.get(
		"/api/chat/room/:id/message",
		{
			preHandler: authGuard,
		},
		(req: FastifyRequest, rep: FastifyReply) => {
			const me = chat.getOrCreateUser(req.user!.id, req.user!.username);
			const roomId = (req.params as { id: string }).id;
			const room = chat.rooms.get(roomId);

			if (!room) {
				return rep.code(STATUS.not_found).send({ message: "Room not found" });
			}
			if (!room.users.has(me)) {
				return rep.code(STATUS.unauthorized).send({ message: "User not allow" });
			}
			const allMess = room.messages.slice(-32);

			return rep.code(STATUS.success).send(allMess);
		},
	);

	fastify.post(
		"/api/chat/private/:username",
		{
			preHandler: authGuard,
		},
		async (req: FastifyRequest, rep: FastifyReply) => {
			const me = chat.getOrCreateUser(req.user!.id, req.user!.username);
			const targetName = (req.params as { username: string }).username;
			try {
				const targetUser = userIdByUsername.get({ username: targetName });
				if (!targetUser) {
					throw new Error("Username not found");
				}
				const target = chat.getOrCreateUser(targetUser.id, targetName);
				const room = await chat.createPrivateRoom(me, target);
				return rep.send({ roomId: room.id });
			} catch (err) {
				return rep.code(STATUS.bad_request).send({ message: (err as Error).message });
			}
		},
	);
}
