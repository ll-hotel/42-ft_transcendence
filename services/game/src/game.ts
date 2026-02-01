import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as tables from "./utils/db/tables";
import { authGuard } from "./utils/security/authGuard";
import { MESSAGE, schema, STATUS } from "./utils/http-reply";
import { create_game, create_local_game, kill_game as kill_local_game } from "./serverside";
import * as serverside from "./serverside";
import { Mode as GameMode } from "./types";

class Game {
	static setup(app: FastifyInstance) {
		app.get("/api/game/current", { preHandler: authGuard }, Game.getCurrent);
		app.get("/api/game/:id", { preHandler: authGuard, schema: schema.params({ id: "number" }, ["id"]) }, Game.getById);
		app.post("/api/game/create", { preHandler: authGuard, schema: schema.body({p1Id: "number", p2Id: "number"}, ["p1Id", "p2Id"])}, Game.create);

		app.post("/api/game/launch", {preHandler: authGuard, schema: schema.body({matchId: "number"}, ["matchId"])}, Game.LaunchGame);
		app.post("/api/game/launch/local", {preHandler: authGuard}, Game.LaunchLocalGame);

		app.post("/api/game/kill/local", {preHandler: authGuard, schema: schema.body({matchId: "number"}, ["matchId"])}, Game.killLocalGame)
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

		create_game(matchId, p1.uuid, p2.uuid);

		return rep.code(STATUS.success).send({ message: "Game launched"});
	}

	static LaunchLocalGame(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const inMatch = db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(
				drizzle.eq(tables.matches.player1Id, usr.id),
				drizzle.eq(tables.matches.player2Id, usr.id)
			),
			drizzle.ne(tables.matches.status, "ended")
		)).prepare().get() != undefined;
		if (inMatch) {
			return rep.code(STATUS.bad_request).send({ message: "Already in a game" });
		}

		const inQueue = db.select().from(tables.matchmakingQueue).where(
			drizzle.eq(tables.matchmakingQueue.userId, usr.id)
		).prepare().get() != undefined;
		if (inQueue) {
			return rep.code(STATUS.bad_request).send({ message: "Can not start local game while in queue" });
		}

		const matchId = create_local_game(usr.uuid);
		if (matchId == null) {
			return rep.code(STATUS.bad_request).send({ message: "Already in a game" });
		}

		return rep.code(STATUS.success).send({ message: "Local game launched", matchId: matchId});
	}

	static async killLocalGame(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const { matchId } = req.body as { matchId: number };

		const game = serverside.games.get(matchId);
		if (!game) {
			return rep.code(STATUS.not_found).send({ message: "Local Game not found" })
		}
		if (game.mode != GameMode.local) {
			return rep.code(STATUS.bad_request).send({ message: "Not a local game" })
		}
		if (game.p1_uuid != usr.uuid) {
			return rep.code(STATUS.bad_request).send({ message: "Not in game" })
		}

		if (kill_local_game(usr.uuid, matchId))
			return rep.code(STATUS.success).send({ message: "Local game killed" });

		return rep.code(STATUS.bad_request).send({ message: "You should not be there" });
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
	Game.setup(fastify);
}
