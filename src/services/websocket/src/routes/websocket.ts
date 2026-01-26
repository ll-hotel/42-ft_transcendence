import { FastifyInstance, FastifyRequest } from "fastify";
import router from "../router";
import { authGuard } from "../utils/security/authGuard";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

async function route(ws: WebSocket, req: FastifyRequest) {
	router(req.user!, ws);
}
