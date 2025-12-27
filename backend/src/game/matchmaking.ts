import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";
import { db } from "../db/database";
import { matchmakingQueue, matches } from "../db/tables";
import { eq, or, and } from "drizzle-orm";
import { notifyUser } from "../websocket/matchmaking.ws";

class Matchmaking {

	static setup(app: FastifyInstance) {
		app.get("/api/matchmaking/join", { preHandler: authGuard, websocket: true }, Matchmaking.joinQueue);
		app.delete("/api/matchmaking/leave", { preHandler: authGuard }, Matchmaking.leaveQueue);
	}

	static async joinQueue(ws: WebSocket, req: FastifyRequest) {
		const usr = req.user!;

		const [inQueue] = await db.select().from(matchmakingQueue).where(eq(matchmakingQueue.userId, usr.id));
		if (inQueue)
			return ws.close(STATUS.bad_request, JSON.stringify({ message: "Already in queue" }));

		const [isPlaying] = await db.select().from(matches).where(and(
			or(eq(matches.player1Id, usr.id), eq(matches.player2Id, usr.id)),
			eq(matches.status, "ongoing")));
		if (isPlaying)
			return ws.close(STATUS.bad_request, JSON.stringify({ message: "Already in game" }));

		await db.insert(matchmakingQueue).values({ userId: usr.id });

		const players = await db.select().from(matchmakingQueue).limit(2);

		if (players.length < 2)
			return ws.close(STATUS.success, JSON.stringify({ message: "Waiting for opponent" }));

		const [p1, p2] = players;

		const [match] = await db.insert(matches).values({
			player1Id: p1.userId,
			player2Id: p2.userId,
			status: "ongoing"
		})
			.returning();

		await db.delete(matchmakingQueue)
			.where(or(
				eq(matchmakingQueue.userId, p1.userId),
				eq(matchmakingQueue.userId, p2.userId)
			));

		notifyUser(p1.userId, {
			type: "MATCH_FOUND",
			matchId: match.id,
			opponentId: p2.userId,
		});

		notifyUser(p2.userId, {
			type: "MATCH_FOUND",
			matchId: match.id,
			opponentId: p1.userId,
		});

		return ws.close(STATUS.success, JSON.stringify({ message: "Match started", matchId: match.id }));
	}


	static async leaveQueue(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [player] = await db.select()
			.from(matchmakingQueue)
			.where(eq(matchmakingQueue.userId, usr.id));

		if (!player)
			return rep.code(400).send({ message: "User not in queue" });

		await db.delete(matchmakingQueue)
			.where(eq(matchmakingQueue.userId, usr.id));

		return rep.code(STATUS.success).send({ message: "Left queue" });
	}

}

export default function(fastify: FastifyInstance) {
	Matchmaking.setup(fastify);
}
