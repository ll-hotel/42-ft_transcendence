import { FastifyPluginCallback } from "fastify";
import conn from "../connection";

const matchmakingWS: FastifyPluginCallback = (fastify, _opts, done) => {

	fastify.get("/ws/matchmaking", { websocket: true }, (socket, req) => {
		// DEV ONLY BEFORE IMPLEMENTING JWT CHECK ==> pass userID to query (wss://localhost:8080/ws/matchmaking?userId=xxx)
		const userId = Number((req.query as any)?.userId);
		if (!userId) {
			return;
		}
		socket.close();
		conn.send(userId, { type: "ready", source: "/ws/matchmaking" })
	});

	done();
};

export default matchmakingWS;
