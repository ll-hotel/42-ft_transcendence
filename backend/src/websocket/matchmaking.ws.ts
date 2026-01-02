import { FastifyPluginCallback } from "fastify";
import socket from "../socket";

const matchmakingWS: FastifyPluginCallback = (fastify, _opts, done) => {

	fastify.get("/ws/matchmaking", { websocket: true }, (ws, req) => {
		// DEV ONLY BEFORE IMPLEMENTING JWT CHECK ==> pass userID to query (wss://localhost:8080/ws/matchmaking?userId=xxx)
		const userId = Number((req.query as any)?.userId);
		if (!userId) {
			return;
		}
		ws.close();
		socket.send(userId, { type: "ready", source: "/ws/matchmaking" })
	});

	done();
};

export default matchmakingWS;
