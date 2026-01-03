import { FastifyInstance, FastifyRequest } from "fastify";
import { authGuard } from "./security/authGuard";
import socket from "./socket";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

function route(ws: WebSocket, req: FastifyRequest) {
	const clientId = req.user!.id;
	socket.connect(clientId, ws);
}
