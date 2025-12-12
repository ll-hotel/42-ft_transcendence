import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authGuard } from "../security/authGuard";
import { db } from "../db/database";
import { matches } from "../db/tables";
import { eq, or, and } from "drizzle-orm";
import { STATUS } from "../shared";

class Match {
	static setup(app: FastifyInstance) {
		app.get('/api/match/current', { preHandler: authGuard }, Match.getCurrent);
		app.get('/api/match/:id', { preHandler: authGuard }, Match.getMatchById);

		app.post('/api/match/:id/end', { preHandler: authGuard }, Match.endMatch);

	}

	static async getCurrent(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [match] = await db.select().from(matches).where(and(
			or(eq(matches.player1Id, usr.id), eq(matches.player2Id, usr.id)),
			eq(matches.status, "ongoing")));
		if (!match)
			return rep.code(STATUS.not_found).send({ message: "No ongoing match"});

		return rep.code(STATUS.success).send(match);
	}

	static async getMatchById(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number};
		const matchId = Number(id);
		
		const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
		if (!match)
			return rep.code(STATUS.not_found).send({ message : "Match not found"});

		return rep.code(STATUS.success).send(match);
	}

	static async endMatch(req:FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number};
		const matchId = Number(id);
		const { winnerId, scoreP1, scoreP2 } = req.body as any;

		const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
		if (!match)
			return rep.code(STATUS.not_found).send({ message : "Match not found"});
		if (match.status !== "ongoing")
			return rep.code(STATUS.bad_request).send({ message : "Match already ended"});

		await db.update(matches).set({
			status: "ended",
			winnerId,
			scoreP1,
			scoreP2,
			endedAt: new Date(),
		}).where(eq(matches.id, matchId));

	}
}

export default function(fastify: FastifyInstance) {
	Match.setup(fastify);
}



