import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authGuard } from "../security/authGuard";
import { db } from "../db/database";
import { matches, tournamentMatches } from "../db/tables";
import { eq, or, and } from "drizzle-orm";
import { STATUS } from "../shared";
import {Tournament} from "./tournament"

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
			endedAt: Date.now(),
		}).where(eq(matches.id, matchId));

		const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.matchId), matchId);
		if (tm)
			Tournament.tournamentEndMatch(matchId, winnerId);
		
		return rep.code(STATUS.success).send({ message: "Match ended"});

	}
}

export default function(fastify: FastifyInstance) {
	Match.setup(fastify);
}



