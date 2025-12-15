import { FastifyInstance, FastifyRequest } from "fastify";
import Chat from "../chat";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";

export function chatRoute(fastify: FastifyInstance) {
	fastify.get(
		"/api/chat/connect",
		{
			websocket: true,
			preHandler: authGuard,
		},
		newWebsocketConnection
	);
	fastify.get(
		"/api/chat/room/:id",
		{
			preHandler: authGuard,
		},
		(req, rep) => {
			const chatuser = chat.users.get("@" + req.user!.username);
			if (!chatuser) {
				return rep.code(STATUS.bad_request).send({ message: "User not registered" });
			}
			const roomId = "#" + (req.params as { id: string }).id;
			if (roomId.length == 1 || !chat.rooms.has(roomId)) {
				return rep.code(STATUS.not_found).send({ message: "Not found" });
			}
			rep.code(STATUS.success).send({ message: "Success" });
		}
	);
}

const chat = new Chat.Instance();

function newWebsocketConnection(ws: WebSocket, req: FastifyRequest) {
	const user = req.user!;
	if (!chat.createUser(user.username, ws)) {
		return ws.close(STATUS.bad_request);
	}
}
