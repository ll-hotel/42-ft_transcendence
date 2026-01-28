import { FastifyInstance, FastifyRequest } from "fastify";
import * as WebSocket from "ws";
import router from "../router";
import { authGuard } from "../utils/security/authGuard";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

async function route(ws: WebSocket.WebSocket, req: FastifyRequest) {
	if (ws.readyState == ws.OPEN) console.log(req.user!.username + " connected.");
	ws.addEventListener("close", () => console.log(req.user!.username + " disconnected."));
	router(req.user!, ws);
}
