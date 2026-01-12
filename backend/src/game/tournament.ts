import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { schema, STATUS } from "../shared";

export class Tournament {
	static setup(app: FastifyInstance) {
		app.post("/api/tournament/create", {
			preHandler: authGuard,
			schema: schema.body({ name: "string", size: "number" }),
		}, Tournament.createTournament);
		app.post(
			"/api/tournament/join",
			{ preHandler: authGuard, schema: schema.body({ name: "string" }) },
			Tournament.joinTournament,
		);
		app.post(
			"/api/tournament/start",
			{ preHandler: authGuard, schema: schema.body({ name: "string" }) },
			Tournament.startTournament,
		);
		app.get(
			"/api/tournament/:id",
			{ preHandler: authGuard, schema: schema.params({ id: "number" }) },
			Tournament.getTournament,
		);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const { name, size } = req.body as { name: string, size: number };

		if (!name || (size !== 4 && size !== 8)) {
			return rep.code(STATUS.bad_request).send({ message: "Missing name or wrong tournament size" });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(drizzle.and(
			drizzle.eq(tables.tournamentPlayers.userId, user.id),
			drizzle.eq(tables.tournamentPlayers.eliminated, 0),
		));
		if (alreadyInTournament) {
			return rep.code(STATUS.bad_request).send({
				message: "Already in tournament",
				tournamentId: alreadyInTournament.tournamentId,
			});
		}
		const [tournament] = await db.insert(tables.tournaments).values({
			name,
			createdBy: user.uuid,
			size: size,
			createdAt: Date.now(),
		}).returning();
		await db.insert(tables.tournamentPlayers).values({
			tournamentId: tournament.id,
			userId: user.id,
			userUuid: user.uuid,
		});
		return rep.code(STATUS.created).send({
			message: "Tournament created",
			tournamentName: tournament.name,
			tournamentId: tournament.id,
		});
	}

	static async joinTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const tournamentName = (req.body as { name: string }).name;
		const [tournament] = await db.select().from(tables.tournaments).where(
			drizzle.eq(tables.tournaments.name, tournamentName),
		);
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		if (tournament.status !== "pending") {
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended", started: true });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.userId, user.id),
		);
		if (alreadyInTournament) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament", joined: true });
		}
		const [alreadyInMatch] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(drizzle.eq(tables.matches.player1Id, user.id), drizzle.eq(tables.matches.player2Id, user.id)),
			drizzle.or(drizzle.eq(tables.matches.status, "pending"), drizzle.eq(tables.matches.status, "ongoing")),
		));
		if (alreadyInMatch) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match", playing: true });
		}
		const players = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.tournamentId, tournament.id),
		);
		if (players.length === 8) {
			return rep.code(STATUS.bad_request).send({ message: "Tournament full", full: true });
		}
		await db.insert(tables.tournamentPlayers).values({
			tournamentId: tournament.id,
			userId: user.id,
			userUuid: user.uuid,
		});
		return rep.code(STATUS.success).send({ message: "Joined tournament", tournamentId: tournament.id });
	}

	static async startTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const tournamentName = (req.body as { name: string }).name;

		const [tournament] = await db.select().from(tables.tournaments).where(
			drizzle.eq(tables.tournaments.name, tournamentName),
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
			drizzle.eq(tables.tournamentPlayers.tournamentId, tournament.id),
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
			{ tournamentId: tournament.id, matchId: m1.id, round: 1 },
			{ tournamentId: tournament.id, matchId: m2.id, round: 1 },
		]);

		await db.update(tables.tournaments).set({ status: "ongoing" }).where(
			drizzle.eq(tables.tournaments.id, tournament.id),
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

	static async getTournament(req: FastifyRequest, rep: FastifyReply) {
		const tournamentId = (req.params as { id: number }).id;

		const [tournament] = await db.select().from(tables.tournaments).where(
			drizzle.eq(tables.tournaments.id, tournamentId),
		);
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		const playerLinks = await db.select().from(tables.tournamentPlayers).where(
			drizzle.eq(tables.tournamentPlayers.tournamentId, tournamentId),
		);
		const players = await db.select().from(tables.users).where(
			drizzle.inArray(tables.users.uuid, playerLinks.map(link => link.userUuid)),
		);
		const playerNames = playerLinks.map(link => players.find(player => player.uuid == link.userUuid)!.displayName);
		const matchLinks = await db.select().from(tables.tournamentMatches).where(
			drizzle.eq(tables.tournamentMatches.tournamentId, tournamentId),
		);
		if (matchLinks.length === 0) {
			return rep.code(STATUS.success).send({
				tournament,
				players: playerNames,
				rounds: [],
			});
		}
		const matchIdList = matchLinks.map(x => x.matchId);
		const allMatches = await db.select().from(tables.matches).where(
			drizzle.inArray(tables.matches.id, matchIdList),
		);
		const rounds: any[][] = [];

		for (let i = 0; i < matchLinks.length; i++) {
			const match = allMatches.find(x => x.id === matchLinks[i].matchId);
			if (!match) continue;
			const uuid1 = playerLinks.find(x => x.userId === match.player1Id)!.userUuid;
			const uuid2 = playerLinks.find(x => x.userId === match.player2Id)!.userUuid;
			if (!rounds[matchLinks[i].round]) {
				rounds[matchLinks[i].round] = [];
			}
			rounds[matchLinks[i].round].push({
				matchId: match.id,
				status: match.status,
				winnerId: match.winnerId,
				p1: { name: players.find(player => player.uuid == uuid1)!.displayName, score: match.scoreP1 },
				p2: { name: players.find(player => player.uuid == uuid2)!.displayName, score: match.scoreP2 },
			});
		}
		return rep.code(STATUS.success).send({
			tournament,
			players: playerNames,
			rounds,
		});
	}
}

export default function(fastify: FastifyInstance) {
	Tournament.setup(fastify);
}