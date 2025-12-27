import { FastifyPluginCallback } from "fastify";

const clients = new Map<number, WebSocket>();

export function notifyUser(userId: number, payload: any) {
	const ws = clients.get(userId);
	if (ws && ws.readyState === ws.OPEN)
		ws.send(JSON.stringify(payload));
}

const matchmakingWS: FastifyPluginCallback = (fastify, _opts, done) => {

	fastify.get("/ws/matchmaking", { websocket: true }, (socket, req) => {
		// DEV ONLY BEFORE IMPLEMENTING JWT CHECK ==> pass userID to query (wss://localhost:8080/ws/matchmaking?userId=xxx)
		const userId = Number((req.query as any)?.userId);
		if (!userId) {
			socket.close();
			return;
		}
		if (clients.has(userId))
			clients.get(userId)!.close();
		clients.set(userId, socket);
		socket.send(JSON.stringify({ type: "WS_READY" }));

		socket.on("close", () => {
			clients.delete(userId);
			console.log("WS OFF", userId);
		});
	});

	done();
};

export default matchmakingWS;
