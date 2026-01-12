import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";

export class Tournament {
	static setup(app: FastifyInstance) {
		app.post("/api/tournaments/create", { preHandler: authGuard }, Tournament.createTournament);
		app.post("/api/tournaments/:id/join", { preHandler: authGuard }, Tournament.joinTournament);
		app.post("/api/tournaments/:id/start", { preHandler: authGuard }, Tournament.startTournament);
		app.get("/api/tournament/:id/status", { preHandler: authGuard }, Tournament.tournamentStatus);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const { name, size } = req.body as { name: string, size: number };

		if (!name || (size !== 4 && size !== 8)) {
			return rep.code(STATUS.bad_request).send({ message: "Missing name or wrong tournament's size" });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(drizzle.and(
			drizzle.eq(tables.tournamentPlayers.userId, usr.id),
			drizzle.eq(tables.tournamentPlayers.eliminated, 0),
		));
		if (alreadyInTournament) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament" });
		}
		const [tournament] = await db.insert(tables.tournaments).values({
			name,
			createdBy: usr.uuid,
			size: size,
			createdAt: Date.now(),
		}).returning();
		await db.insert(tables.tournamentPlayers).values({
			tournamentId: tournament.id,
			userId: usr.id,
			userUuid: usr.uuid,
		});
		return rep.code(STATUS.created).send({
			message: "Tournament created",
			tournament,
		});
	}

	static async joinTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const tournamentId = (req.params as { id: number }).id;
		const [tournament] = await db.select().from(tables.tournaments).where(
			drizzle.eq(tables.tournaments.id, tournamentId),
		);
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		if (tournament.status !== "pending") {
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended" });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.userId, user.id),
		);
		if (alreadyInTournament) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament " });
		}
		const [alreadyInMatch] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(drizzle.eq(tables.matches.player1Id, user.id), drizzle.eq(tables.matches.player2Id, user.id)),
			drizzle.or(drizzle.eq(tables.matches.status, "pending"), drizzle.eq(tables.matches.status, "ongoing")),
		));
		if (alreadyInMatch) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match" });
		}
		const players = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.tournamentId, tournamentId),
		);
		if (players.length === 8) {
			return rep.code(STATUS.bad_request).send({ message: "Tournament full" });
		}
		await db.insert(tables.tournamentPlayers).values({
			tournamentId,
			userId: user.id,
			userUuid: user.uuid,
		});
		return rep.code(STATUS.success).send({ message: "Joined tournament" });
	}

	static async startTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const tournamentId = (req.params as { id: number }).id;

		const [tournament] = await db.select().from(tables.tournaments).where(
			drizzle.eq(tables.tournaments.id, tournamentId),
		);
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		if (user.uuid !== tournament.createdBy) {
			return rep.code(STATUS.unauthorized).send({ message: "You are not the creator of this tournament " });
		}
		if (tournament.status !== "pending") {
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended" });
		}

		const players = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.tournamentId, tournamentId),
		);
		if (players.length !== 4) {
			return rep.code(STATUS.bad_request).send({ message: "Not enough players" });
		}

		const [m1] = await db.insert(tables.matches).values({
			player1Id: players[0].userId,
			player2Id: players[1].userId,
			status: "ongoing",
		}).returning();
		const [m2] = await db.insert(tables.matches).values({
			player1Id: players[2].userId,
			player2Id: players[3].userId,
			status: "ongoing",
		}).returning();

		await db.insert(tables.tournamentMatches).values([
			{ tournamentId, matchId: m1.id, round: 1 },
			{ tournamentId, matchId: m2.id, round: 1 },
		]);

		await db.update(tables.tournaments).set({ status: "ongoing" }).where(
			drizzle.eq(tables.tournaments.id, tournamentId),
		);

		// notifyUser TOURNAMENT_STARTED

		return rep.code(STATUS.success).send({
			message: "Tournament started",
			matches: [m1, m2],
		});
	}

	static async tournamentEndMatch(matchId: number, winnerId: number) {
		const [tm] = await db.select().from(tables.tournamentMatches).where(
			drizzle.eq(tables.tournamentMatches.matchId, matchId),
		);
		if (!tm) {
			return;
		}
		if (tm.round === 1) {
			await Tournament.semiFinalEnd(tm.tournamentId);
		} else if (tm.round === 2) {
			await db.update(tables.tournaments).set({ status: "ended" }).where(
				drizzle.eq(tables.tournaments.id, tm.tournamentId),
			);
			// notify User TOURNAMENT_ENDED
		}
	}

	static async semiFinalEnd(tournamentId: number) {
		const link = await db.select().from(tables.tournamentMatches).where(drizzle.and(
			drizzle.eq(tables.tournamentMatches.tournamentId, tournamentId),
			drizzle.eq(tables.tournamentMatches.round, 1),
		));

		if (link.length !== 2) {
			return;
		}

		const semiMatches = await db.select().from(tables.matches).where(drizzle.or(
			drizzle.eq(tables.matches.id, link[0].matchId),
			drizzle.eq(tables.matches.id, link[1].matchId),
		));

		const finished = semiMatches.filter(x => x.status === "ended");
		if (finished.length < 2) {
			return;
		}

		const winner1 = finished[0].winnerId;
		const winner2 = finished[1].winnerId;

		if (!winner1 || !winner2) {
			return;
		}

		const [finalMatch] = await db.insert(tables.matches).values({
			player1Id: Number(winner1),
			player2Id: Number(winner2),
			status: "ongoing",
		}).returning();

		// notifyUser FINAL_MATCH
		await db.insert(tables.tournamentMatches).values({
			tournamentId,
			matchId: finalMatch.id,
			round: 2,
		});
	}

	static async tournamentStatus(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };

		const [tournament] = await db.select().from(tables.tournaments).where(drizzle.eq(tables.tournaments.id, id));
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		const playersLink = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.tournamentId, id),
		);
		const players = playersLink.map(x => ({
			userId: x.userId,
			userUuid: x.userUuid,
			eliminated: x.eliminated,
		}));
		const matchLinks = await db.select().from(tables.tournamentMatches).where(
			drizzle.eq(tables.tournamentMatches.tournamentId, id),
		);
		if (matchLinks.length === 0) {
			return rep.code(STATUS.success).send({
				tournament,
				players,
				rounds: {},
			});
		}
		const matchIds = matchLinks.map(x => x.matchId);
		const allMatches = await db.select().from(tables.matches).where(drizzle.inArray(tables.matches.id, matchIds));
		const rounds: any = {};

		for (let i = 0; i < matchLinks.length; i++) {
			const match = allMatches.find(x => x.id === matchLinks[i].matchId);
			if (!match) continue;
			const p1 = players.find(x => x.userId === match.player1Id);
			const p2 = players.find(x => x.userId === match.player2Id);
			if (!rounds[matchLinks[i].round]) {
				rounds[matchLinks[i].round] = [];
			}
			rounds[matchLinks[i].round].push({
				matchId: match.id,
				player1Uuid: p1 ? p1.userUuid : null,
				player2Uuid: p2 ? p2.userUuid : null,
				status: match.status,
				winnerId: match.winnerId,
				scoreP1: match.scoreP1,
				scoreP2: match.scoreP2,
			});
		}
		return rep.code(STATUS.success).send({
			tournament,
			players,
			rounds,
		});
	}
}

export default function(fastify: FastifyInstance) {
	Tournament.setup(fastify);
}
