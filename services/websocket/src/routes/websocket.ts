import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as WebSocket from "ws";
import router from "../router";
import { authGuard } from "../utils/security/authGuard";
import {STATUS} from "../utils/http-reply";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
	fastify.get("/api/websocket/ping", { preHandler: authGuard }, ping);
}

async function route(ws: WebSocket.WebSocket, req: FastifyRequest) {
	if (ws.readyState == ws.OPEN) console.log(req.user!.username + " connected.");
	ws.addEventListener("close", () => console.log(req.user!.username + " disconnected."));
	router(req.user!, ws);
}

function ping(_: FastifyRequest, rep: FastifyReply): void {
	rep.code(STATUS.success).send({ message: "pong" });
}
