import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as dbM from "../db/methods";
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
			"/api/tournament",
			{ preHandler: authGuard, schema: schema.query({ name: "string" }) },
			Tournament.queryTournament,
		);
		app.get("/api/tournament/list", { preHandler: authGuard }, Tournament.getTournamentList);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const { name, size } = req.body as { name: string, size: number };

		// Sanitization.
		if (name.length > 16 || /(?:[a-zA-Z].*)\w+/.test(name) == false) {
			return rep.code(STATUS.bad_request).send({ message: "Bad tournament name" });
		}
		if (size !== 4 && size !== 8) {
			return rep.code(STATUS.bad_request).send({ message: "Bad tournament size" });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(orm.and(
			orm.eq(tables.tournamentPlayers.userId, user.id),
			orm.eq(tables.tournamentPlayers.eliminated, 0),
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
		await dbM.addTournamentPlayer(tournament.id, user);
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
			orm.eq(tables.tournaments.name, tournamentName),
		);
		if (!tournament) {
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		}
		if (tournament.status !== "pending") {
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended", started: true });
		}
		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(
			orm.eq(tables.tournamentPlayers.userId, user.id),
		);
		if (alreadyInTournament) {
			const userInWantedTournament: boolean = alreadyInTournament.tournamentId == tournament.id;
			if (userInWantedTournament) {
				return rep.code(STATUS.success).send({ message: "Tournament joined.", joined: true });
			}
			return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament", joined: true });
		}
		const [alreadyInMatch] = await db.select().from(tables.matches).where(orm.and(
			orm.or(orm.eq(tables.matches.player1Id, user.id), orm.eq(tables.matches.player2Id, user.id)),
			orm.or(orm.eq(tables.matches.status, "pending"), orm.eq(tables.matches.status, "ongoing")),
		));
		if (alreadyInMatch) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match", playing: true });
		}
		const players = await db.select().from(tables.tournamentPlayers).where(
			orm.eq(tables.tournamentPlayers.tournamentId, tournament.id),
		);
		if (players.length === 8) {
			return rep.code(STATUS.bad_request).send({ message: "Tournament full", full: true });
		}
		await dbM.addTournamentPlayer(tournament.id, user);
		return rep.code(STATUS.success).send({ message: "Joined tournament", tournamentId: tournament.id });
	}

	static async startTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const tournamentName = (req.body as { name: string }).name;

		const [tournament] = await db.select().from(tables.tournaments).where(
			orm.eq(tables.tournaments.name, tournamentName),
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
			orm.eq(tables.tournamentPlayers.tournamentId, tournament.id),
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
			orm.eq(tables.tournaments.id, tournament.id),
		);

		// notifyUser TOURNAMENT_STARTED

		return rep.code(STATUS.success).send({
			message: "Tournament started",
			matches: [m1, m2],
		});
	}

	static async tournamentEndMatch(matchId: number, winnerId: number) {
		const [tm] = await db.select().from(tables.tournamentMatches).where(
			orm.eq(tables.tournamentMatches.matchId, matchId),
		);
		if (!tm) {
			return;
		}
		if (tm.round === 1) {
			await Tournament.semiFinalEnd(tm.tournamentId);
		} else if (tm.round === 2) {
			await db.update(tables.tournaments).set({ status: "ended" }).where(
				orm.eq(tables.tournaments.id, tm.tournamentId),
			);
			// notify User TOURNAMENT_ENDED
		}
	}

	static async semiFinalEnd(tournamentId: number) {
		const link = await db.select().from(tables.tournamentMatches).where(orm.and(
			orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
			orm.eq(tables.tournamentMatches.round, 1),
		));

		if (link.length !== 2) {
			return;
		}

		const semiMatches = await db.select().from(tables.matches).where(orm.or(
			orm.eq(tables.matches.id, link[0].matchId),
			orm.eq(tables.matches.id, link[1].matchId),
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

		const info = await searchTournamentInfo(tournamentId);
		if (!info) {
			return rep.code(STATUS.not_found).send({ message: "No such tournament" });
		}
		return rep.code(STATUS.success).send(info);
	}

	static async getTournamentList(_req: FastifyRequest, rep: FastifyReply) {
		const dbList = await db.select()
			.from(tables.tournaments)
			.where(orm.eq(tables.tournaments.status, "pending"));

		const promiseList = dbList.map(async (tournament) => {
			const [creator] = await db.select()
				.from(tables.users)
				.where(orm.eq(tables.users.uuid, tournament.createdBy));
			const players = await db.select()
				.from(tables.tournamentPlayers)
				.where(orm.eq(tables.tournamentPlayers.tournamentId, tournament.id));
			return {
				name: tournament.name,
				size: tournament.size || 4,
				createdBy: creator.displayName,
				playersWaiting: players.length,
			};
		});

		const list = [];
		for (const promise of promiseList) {
			list.push(await promise);
		}

		rep.code(STATUS.success).send({ list });
	}

	static async queryTournament(req: FastifyRequest, rep: FastifyReply) {
		const { name: tournamentName } = req.query as { name: string };
		const [tournament] = await db.select()
			.from(tables.tournaments)
			.where(orm.eq(tables.tournaments.name, tournamentName));
		if (!tournament) {
			rep.code(STATUS.not_found).send({ message: "No such tournament" });
			return;
		}
		const info = await searchTournamentInfo(tournament.id);
		if (!info) {
			// Can not happen as the tournament exists.
			return;
		}
		rep.code(STATUS.success).send(info);
	}
}

export default async function(fastify: FastifyInstance) {
	Tournament.setup(fastify);
	const tournaments = await db.select({ id: tables.tournaments.id }).from(tables.tournaments).where(
		orm.eq(tables.tournaments.status, "pending"),
	);
	for (const tournament of tournaments) {
		dbM.deleteTournament(tournament.id);
	}
}

async function searchTournamentInfo(tournamentId: number): Promise<TournamentInfo | null> {
	const [tournament] = await db.select().from(tables.tournaments).where(
		orm.eq(tables.tournaments.id, tournamentId),
	);
	if (!tournament) {
		return null;
	}
	const playerLinks = await db.select().from(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.tournamentId, tournamentId),
	);
	const players = await db.select().from(tables.users).where(
		orm.inArray(tables.users.id, playerLinks.map(link => link.userId)),
	);
	const info: TournamentInfo = {
		name: tournament.name,
		players: players.map((player) => player.displayName),
		rounds: [],
	};
	const matchLinks = await db.select().from(tables.tournamentMatches).where(
		orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
	);
	if (matchLinks.length === 0) {
		return info;
	}

	const matchIds = matchLinks.map(x => x.matchId);
	const dbMatchs = await db.select().from(tables.matches).where(orm.inArray(tables.matches.id, matchIds));
	const matchs: TournamentMatch[] = dbMatchs.map((match) => {
		// Both players exists because the `players` list is made from the tournament players list.
		const player1 = players.find((player) => player.id == match.player1Id)!;
		const player2 = players.find((player) => player.id == match.player2Id)!;
		let winner = null;
		if (match.winnerId) {
			winner = player1.id == match.winnerId ? 1 : 2;
		}
		return {
			matchId: match.id,
			status: match.status,
			winner,
			p1: { name: player1.displayName, score: match.scoreP1 },
			p2: { name: player2.displayName, score: match.scoreP2 },
		};
	});

	info.rounds = [];
	for (let round = 0; Math.pow(2, round) <= tournament.size!; round += 1) {
		const roundMatchs = matchLinks.filter((link) => link.round == round)
			.map((link) => matchs.find((match) => match.matchId == link.matchId)!);
		info.rounds.push(roundMatchs);
	}
	return info;
}

type TournamentInfo = {
	name: string,
	players: string[],
	rounds: TournamentMatch[][],
};
type TournamentMatch = {
	matchId: number,
	status: string,
	winner: number | null,
	p1: { name: string, score: number },
	p2: { name: string, score: number },
};
