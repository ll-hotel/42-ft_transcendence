import { FastifyInstance, FastifyRequest } from "fastify";
import { authGuard } from "./security/authGuard";
import { STATUS } from "./shared";
import socket from "./socket";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

function route(ws: WebSocket, req: FastifyRequest) {
	const clientId = req.user!.id;
	if (socket.clients.has(clientId)) {
		return ws.close(STATUS.bad_request);
	}
	socket.connect(clientId, ws);
}
