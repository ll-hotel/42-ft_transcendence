import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { schema, STATUS } from "../shared";

class Match {
	static setup(app: FastifyInstance) {
		app.get("/api/match/current", { preHandler: authGuard }, Match.getCurrent);
		app.get("/api/match/:id", { preHandler: authGuard, schema: schema.params({ id: "number" }, ["id"]) }, Match.getById);
		// app.post("/api/match/:id/end", { preHandler: authGuard }, Match.end);
		// use case: player invited to play by chat.
		app.post("/api/match/create", { preHandler: authGuard, schema: schema.body({p1Id: "number", p2Id: "number"}, ["p1Id", "p2Id"])}, Match.create);
	}
	static async getCurrent(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [match] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(drizzle.eq(tables.matches.player1Id, usr.id), drizzle.eq(tables.matches.player2Id, usr.id)),
			drizzle.or(drizzle.eq(tables.matches.status, "ongoing"), drizzle.eq(tables.matches.status, "pending")),
		));
		if (!match) {
			return rep.code(STATUS.not_found).send({ message: "User is not in match" });
		}

		return rep.code(STATUS.success).send(match);
	}
	static async getById(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };
		const usr = req.user!;

		const matchId = Number(id);

		const [match] = await db.select().from(tables.matches).where(drizzle.eq(tables.matches.id, matchId));
		if (!match) {
			return rep.code(STATUS.not_found).send({ message: "Match not found" });
		}

		let [user1] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, match.player1Id));
		let [user2] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, match.player2Id));

		/*if (user1.id !== usr.id) {
				[user1, user2] = [user2, user1];
				[match.scoreP1, match.scoreP2] = [match.scoreP2, match.scoreP1];
		}*/


		return rep.code(STATUS.success).send({
			p1: { name: user1.displayName, avatar: user1.avatar, score: match.scoreP1, },
			p2: { name: user2.displayName, avatar: user2.avatar, score: match.scoreP2 },
			status: match.status,
		});
	}
	static async create(req: FastifyRequest, rep: FastifyReply) {
		const { p1Id, p2Id } = req.body as { p1Id: number, p2Id: number };

		const [p1] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, p1Id));
		if (!p1)
			return rep.code(STATUS.bad_request).send({ message: "p1 doesn't exists" });
		const [p2] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, p1Id));
		if (!p2)
			return rep.code(STATUS.bad_request).send({ message: "p2 doesn't exists" });

		const [p1Playing] = await db.select().from(tables.matches).where(
			drizzle.and(
				drizzle.or(
					drizzle.eq(tables.matches.status, "ongoing"),
					drizzle.eq(tables.matches.status, "pending"),
				),
				drizzle.or(
					drizzle.eq(tables.matches.player1Id, p1Id),
					drizzle.eq(tables.matches.player2Id, p1Id),
				),
			),
		);
		const [p2Playing] = await db.select().from(tables.matches).where(
			drizzle.and(
				drizzle.or(
					drizzle.eq(tables.matches.status, "ongoing"),
					drizzle.eq(tables.matches.status, "pending"),
				),
				drizzle.or(
					drizzle.eq(tables.matches.player1Id, p2Id),
					drizzle.eq(tables.matches.player2Id, p2Id),
				),
			),
		);
		if (p1Playing || p2Playing) {
			return rep.code(STATUS.bad_request).send({ message: "Already in game" });
		}

		const [match] = await db.insert(tables.matches).values({
			player1Id: p1Id,
			player2Id: p2Id,
			status: "pending",
		}).returning();

		return rep.code(STATUS.success).send({ message: "Match started", matchId: match.id });
	}
}

export default function(fastify: FastifyInstance) {
	Match.setup(fastify);
}
