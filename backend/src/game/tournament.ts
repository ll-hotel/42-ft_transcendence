import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as dbM from "../db/methods";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { schema, STATUS } from "../shared";
import socket from "../socket";

export class Tournament {
	static setup(app: FastifyInstance) {
		app.post("/api/tournament/create", {
			preHandler: authGuard,
			schema: schema.body({ name: "string", size: "number" }, ["name", "size"]),
		}, Tournament.createTournament);
		app.post(
			"/api/tournament/join",
			{ preHandler: authGuard, schema: schema.body({ name: "string" }, ["name"]) },
			Tournament.joinTournament,
		);
		app.post(
			"/api/tournament/start",
			{ preHandler: authGuard, schema: schema.body({ name: "string" }, ["name"]) },
			Tournament.startTournament,
		);
		app.get(
			"/api/tournament",
			{ preHandler: authGuard, schema: schema.query({ name: "string" }, ["name"]) },
			Tournament.queryTournament,
		);
		app.get("/api/tournament/list", { preHandler: authGuard }, Tournament.getTournamentList);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const { name, size} = req.body as { name: string, size: number};

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

		const [alreadyInMatch] = await db.select().from(tables.matches).where(orm.and(
			orm.or(orm.eq(tables.matches.player1Id, user.id), orm.eq(tables.matches.player2Id, user.id)),
			orm.or(orm.eq(tables.matches.status, "pending"), orm.eq(tables.matches.status, "ongoing")),
		));

		if (alreadyInMatch) {
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match", playing: true });
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
		if (players.length >= tournament.size) {
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
			return rep.code(STATUS.unauthorized).send({ message: "You are not the creator of this tournament" });
		}

		const error = await dbM.startTournament(tournament.id);
		switch (error) {
			case dbM.Error.MissingPlayers:
				return rep.code(STATUS.bad_request).send({ message: "Missing players" });
			case dbM.Error.TournamentNotPending:
				return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended" });
			case dbM.Error.MissingTournament: // Can not happen.
			case null: // No error.
		}

		notifyTournamentStart(tournament.id);

		return rep.code(STATUS.success).send({
			message: "Tournament started",
		});
	}

	// static async tournamentEndMatch(matchId: number, winnerId: number) {
	// 	const [tm] = await db.select().from(tables.tournamentMatches).where(
	// 		orm.eq(tables.tournamentMatches.matchId, matchId),
	// 	);
	// 	if (!tm) {
	// 		return;
	// 	}
	// 	if (tm.round === 1) {
	// 		await Tournament.semiFinalEnd(tm.tournamentId);
	// 	} else if (tm.round === 2) {
	// 		await db.update(tables.tournaments).set({ status: "ended" }).where(
	// 			orm.eq(tables.tournaments.id, tm.tournamentId),
	// 		);
	// 		// notify User TOURNAMENT_ENDED
	// 	}
	// }

	// static async semiFinalEnd(tournamentId: number) {
	// 	const link = await db.select().from(tables.tournamentMatches).where(orm.and(
	// 		orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
	// 		orm.eq(tables.tournamentMatches.round, 1),
	// 	));

	// 	if (link.length !== 2) {
	// 		return;
	// 	}

	// 	const semiMatches = await db.select().from(tables.matches).where(orm.or(
	// 		orm.eq(tables.matches.id, link[0].matchId),
	// 		orm.eq(tables.matches.id, link[1].matchId),
	// 	));

	// 	const finished = semiMatches.filter(x => x.status === "ended");
	// 	if (finished.length < 2) {
	// 		return;
	// 	}

	// 	const winner1 = finished[0].winnerId;
	// 	const winner2 = finished[1].winnerId;

	// 	if (!winner1 || !winner2) {
	// 		return;
	// 	}

	// 	const [finalMatch] = await db.insert(tables.matches).values({
	// 		player1Id: Number(winner1),
	// 		player2Id: Number(winner2),
	// 		status: "ongoing",
	// 	}).returning();

	// 	// notifyUser FINAL_MATCH
	// 	await db.insert(tables.tournamentMatches).values({
	// 		tournamentId,
	// 		matchId: finalMatch.id,
	// 		round: 2,
	// 	});
	// }

	static async getTournament(req: FastifyRequest, rep: FastifyReply) {
		const tournamentId = (req.params as { id: number }).id;

		const info = await dbM.searchTournamentInfo(tournamentId);
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
		const [creator] = await db.select({ name: tables.users.displayName }).from(tables.users).where(
			orm.eq(tables.users.uuid, tournament.createdBy),
		);
		const info = await dbM.searchTournamentInfo(tournament.id);
		if (!info) {
			// Can not happen as the tournament exists.
			return;
		}
		rep.code(STATUS.success).send({ creator, ...info });
	}
}

async function notifyTournamentStart(tournamentId: number) {
	const [tournament] = await db.select().from(tables.tournaments).where(
		orm.eq(tables.tournaments.id, tournamentId),
	);
	if (!tournament || tournament.status != "ongoing") {
		return;
	}
	const matchsLinks = await db.select().from(tables.tournamentMatches).where(
		orm.and(
			orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
			orm.eq(tables.tournamentMatches.round, tournament.round!),
		),
	);
	const matchIds = matchsLinks.map((link) => link.matchId);
	const matchs = await db.select().from(tables.matches).where(
		orm.inArray(tables.matches.id, matchIds),
	);
	const playerIds = matchs.flatMap((match) => [match.player1Id, match.player2Id]);
	const players = await db.select().from(tables.users).where(
		orm.inArray(tables.users.id, playerIds),
	);
	for (const match of matchs) {
		const player1 = players.find((player) => player.id == match.player1Id)!;
		const player2 = players.find((player) => player.id == match.player2Id)!;
		const message1 = { topic: "vs:start", match: match.id, opponent : player2.displayName};
		const message2 = { topic: "vs:start", match: match.id, opponent : player1.displayName };
		socket.send(player1.uuid, message1);
		socket.send(player2.uuid, message2);
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
