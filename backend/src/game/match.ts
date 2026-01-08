import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";
import { Tournament } from "./tournament";

class Match {
	static setup(app: FastifyInstance) {
		app.get("/api/match/current", { preHandler: authGuard }, Match.getCurrent);
		app.get("/api/match/:id", { preHandler: authGuard }, Match.getById);
		app.post("/api/match/:id/end", { preHandler: authGuard }, Match.end);
		// use case: player invited to play by chat.
		app.post("/api/match/create", { preHandler: authGuard }, Match.create);
	}
	static async getCurrent(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [match] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(drizzle.eq(tables.matches.player1Id, usr.id), drizzle.eq(tables.matches.player2Id, usr.id)),
			drizzle.eq(tables.matches.status, "ongoing"),
		));
		if (!match) {
			return rep.code(STATUS.not_found).send({ message: "User is not in match" });
		}

		return rep.code(STATUS.success).send(match);
	}
	static async getById(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };
		const matchId = Number(id);

		const [match] = await db.select().from(tables.matches).where(drizzle.eq(tables.matches.id, matchId));
		if (!match) {
			return rep.code(STATUS.not_found).send({ message: "Match not found" });
		}

		const [user1] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, match.player1Id));
		const [user2] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, match.player2Id));

		return rep.code(STATUS.success).send({
			player1: user1.username,
			player2: user2.username,
			scoreP1: match.scoreP1,
			scoreP2: match.scoreP2,
			finished: match.status != "pending",
		});
	}
	static async end(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };
		const matchId = Number(id);
		const { winnerId, scoreP1, scoreP2 } = req.body as any;

		const [match] = await db.select().from(tables.matches).where(drizzle.eq(tables.matches.id, matchId));
		if (!match) {
			return rep.code(STATUS.not_found).send({ message: "Match not found" });
		}
		if (match.status !== "ongoing") {
			return rep.code(STATUS.bad_request).send({ message: "Match already ended" });
		}

		await db.update(tables.matches).set({
			status: "ended",
			winnerId,
			scoreP1,
			scoreP2,
			endedAt: Date.now(),
		}).where(drizzle.eq(tables.matches.id, matchId));

		const [tm] = await db.select().from(tables.tournamentMatches).where(
			drizzle.eq(tables.tournamentMatches.matchId, matchId),
		);
		if (tm) {
			await Tournament.tournamentEndMatch(matchId, winnerId);
		}

		return rep.code(STATUS.success).send({ message: "Match ended" });
	}
	static async create(req: FastifyRequest, rep: FastifyReply) {
		const { p1Id, p2Id } = req.body as { p1Id: number, p2Id: number };

		const [p1Playing] = await db.select().from(tables.matches).where(
			drizzle.and(
				drizzle.eq(tables.matches.status, "ongoing"),
				drizzle.or(
					drizzle.eq(tables.matches.player1Id, p1Id),
					drizzle.eq(tables.matches.player2Id, p1Id),
				),
			),
		);
		const [p2Playing] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.eq(tables.matches.status, "ongoing"),
			drizzle.or(
				drizzle.eq(tables.matches.player1Id, p2Id),
				drizzle.eq(tables.matches.player2Id, p2Id),
			),
		));
		if (p1Playing || p2Playing) {
			return rep.code(STATUS.bad_request).send({ message: "Already in game" });
		}

		const [match] = await db.insert(tables.matches).values({
			player1Id: p1Id,
			player2Id: p2Id,
			status: "ongoing",
		}).returning();

		return rep.code(STATUS.success).send({ message: "Match started", matchId: match.id });
	}
}

export default function(fastify: FastifyInstance) {
	Match.setup(fastify);
}
