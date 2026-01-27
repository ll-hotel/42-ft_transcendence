import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Chat from "./chat";
import { authGuard } from "./utils/security/authGuard";
import { STATUS } from "./utils/http-reply";
import { getUserIdByUsername } from "./utils/db/methods";

export function chatRoute(fastify: FastifyInstance) {
	fastify.get(
		"/api/chat/connect",
		{
			websocket: true,
			preHandler: authGuard,
		},
		(ws : WebSocket, req : FastifyRequest) => {
			chat.newWebsocketConnection(ws, req);
		}
	);

	fastify.get(
		"/api/chat/room/:id",
		{
			preHandler: authGuard,
		},
		(req : FastifyRequest, rep: FastifyReply) => {
			const me = chat.getOrCreateUser(req.user!.id, req.user!.username);
			const roomId = (req.params as { id: string }).id;
			if (roomId.length == 1 || !chat.rooms.has(roomId)) {
				return rep.code(STATUS.not_found).send({ message: "Room not found" });
			}
			const room = chat.rooms.get(roomId)!;
			return rep.code(STATUS.success).send({ roomId: room.id });
		}
	);

	fastify.get(
		"/api/chat/room/:id/message",
		{
			preHandler:authGuard,
		},
		(req: FastifyRequest, rep: FastifyReply) => {
			const me = chat.getOrCreateUser(req.user!.id, req.user!.username);
			const roomId = (req.params as { id: string }).id;
			const room = chat.rooms.get(roomId);

			if (!room)
				return rep.code(STATUS.not_found).send({ message:"Room not found"});
			if (!room.users.has(me)) 
				return rep.code(STATUS.unauthorized).send({message: "User not allow"})
			const allMess = room.messages.slice(-8);

			return rep.code(STATUS.success).send(allMess);
		}
	)

	fastify.post(
		"/api/chat/private/:username",
		{
			preHandler:authGuard,
		},
		async (req: FastifyRequest, rep: FastifyReply) => {
			const me = chat.getOrCreateUser(req.user!.id, req.user!.username);
			const targetName = (req.params as { username : string}).username;
			try {
				const targetId = await getUserIdByUsername(targetName);
				if (!targetId)
					throw new Error("Username not found");
				const target = chat.getOrCreateUser(targetId, targetName);
				const room = await chat.createPrivateRoom(me,target);
				return rep.send({ roomId : room.id});
			}
			catch (err) {
				return rep.code(STATUS.bad_request).send({message: (err as Error).message })
			}
		}
	);
}

const chat = new Chat.Instance();

