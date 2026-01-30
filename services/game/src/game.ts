import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as tables from "./utils/db/tables";
import { authGuard } from "./utils/security/authGuard";
import { MESSAGE, schema, STATUS } from "./utils/http-reply";
import { create_game } from "./serverside";
import { Mode } from "./types";

class Match {
	static setup(app: FastifyInstance) {
		app.get("/api/game/current", { preHandler: authGuard }, Match.getCurrent);
		app.get("/api/game/:id", { preHandler: authGuard, schema: schema.params({ id: "number" }, ["id"]) }, Match.getById);
		// app.post("/api/match/:id/end", { preHandler: authGuard }, Match.end);
		// use case: player invited to play by chat.
		app.post("/api/game/create", { preHandler: authGuard, schema: schema.body({p1Id: "number", p2Id: "number"}, ["p1Id", "p2Id"])}, Match.create);

		app.post("/api/game/launch", {preHandler: authGuard, schema: schema.body({matchId: "number"}, ["matchId"])}, Match.LaunchGame);
	}
	static async LaunchGame(req: FastifyRequest, rep: FastifyReply){
		const { matchId } = req.body as { matchId: number };
		const usr = req.user!;

		const [matchExists] = await db.select().from(tables.matches)
		.where(drizzle.eq(tables.matches.id, matchId));
		if (!matchExists)
			return rep.code(STATUS.bad_request).send({ message: "Match not found"});

		const [isTmMatch] = await db.select().from(tables.tournamentMatches)
		.where(drizzle.eq(tables.tournamentMatches.matchId, matchId));

		if (matchExists.status === "ended")
			return rep.code(STATUS.bad_request).send({ message: "Match already ended" });
		
		if (matchExists.status !== "pending" && !isTmMatch)
			return rep.code(STATUS.created).send({ message: MESSAGE.match_started});

		const [p1] = await db.select().from(tables.users)
			.where(drizzle.eq(tables.users.id, matchExists.player1Id));
		const [p2] = await db.select().from(tables.users)
			.where(drizzle.eq(tables.users.id, matchExists.player2Id));
		if (!p1 || !p2)
			return rep.code(STATUS.bad_request).send({ message: "User not found" });

		await create_game(matchId, p1.uuid, p2.uuid, Mode.remote);

		return rep.code(STATUS.success).send({ message: "Game Launched"});
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
		const [p2] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, p2Id));
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
