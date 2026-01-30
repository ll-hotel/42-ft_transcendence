import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";
import { schema, STATUS } from "./utils/http-reply";
import { authGuard } from "./utils/security/authGuard";
import socket from "./utils/socket";


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
			"/api/tournament/leave",
			{ preHandler: authGuard, schema: schema.body({ name: "string" }, ["name"]) },
			Tournament.leaveTournament,
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
		app.get("/api/tournament/isTmMatch", { preHandler: authGuard, schema: schema.query({ matchId: "number" }, ["matchId"]) }, Tournament.isTournamentMatch)
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

		const [nameTaken] = await db.select().from(tables.tournaments).where(
			orm.eq(tables.tournaments.name, name),
		);
		if (nameTaken) {
			return rep.code(STATUS.bad_request).send({ message: "Tournament name already taken" });
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
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match"});
		}

		const alreadyInQueue = db.select().from(tables.matchmakingQueue).where(
			orm.eq(tables.matchmakingQueue.userId, user.id)
		).prepare();

		if (alreadyInQueue.all().length) {
			return rep.code(STATUS.bad_request).send({ message: "You are in a Queue"});
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
			orm.and(
				orm.eq(tables.tournamentPlayers.userId, user.id),
				orm.eq(tables.tournamentPlayers.eliminated, 0),
			),
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

		const alreadyInQueue = db.select().from(tables.matchmakingQueue).where(
			orm.eq(tables.matchmakingQueue.userId, user.id)
		).prepare();

		if (alreadyInQueue.all().length) {
			return rep.code(STATUS.bad_request).send({ message: "You are in a Queue"});
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

	static leaveTournament(req: FastifyRequest, rep: FastifyReply): void {
		const body = req.body as { name: string };
		const tournament = db.select().from(tables.tournaments).where(orm.eq(tables.tournaments.name, body.name))
			.prepare().get();
		if (tournament == undefined) {
			rep.code(STATUS.not_found).send({ message: "No such tournament" });
			return;
		}

		const user = req.user!;
		const players = db.select({ id: tables.tournamentPlayers.userId }).from(tables.tournamentPlayers).where(
			orm.eq(tables.tournamentPlayers.tournamentId, tournament.id),
		).prepare().all();
		if (players.find((player) => player.id == user.id) == undefined) {
			rep.code(STATUS.bad_request).send({ message: "You are not in this tournament" });
			return;
		}
		dbM.removeUserFromTournaments(user.uuid);

		rep.code(STATUS.success).send({ message: "Left tournament" });
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

	/* static async handleRoundEnd(tournamentId: number, round: number) {
		const link = await db.select().from(tournamentMatches).where(and(
			eq(tournamentMatches.tournamentId, tournamentId),
			eq(tournamentMatches.round, round)
		));
		const matchIds = link.map(x => x.matchId);
		if (matchIds.length === 0)
			return;
		const roundMatches = await db.select().from(matches).where(inArray(matches.id, matchIds));
		
		const finished = roundMatches.filter(x => x.status === "ended");
		if (finished.length !== roundMatches.length)
			return; // wait for all round's matches to end

		// round ended
		for (let i = 0; i < finished.length; i++) {
			let loserId;
			if (finished[i].winnerId === finished[i].player1Id)
				loserId = finished[i].player2Id;
			else
				loserId = finished[i].player1Id;
			await db.update(tournamentPlayers).set({ eliminated: 1 }).where(and(
				eq(tournamentPlayers.tournamentId, tournamentId),
				eq(tournamentPlayers.userId, loserId),
			));
		}

		const winners = finished.map(x => x.winnerId); //null check
		if (winners.length === 1) {
			const winnerId = winners[0];
			if (winnerId !== null) {
				await db.update(tournamentPlayers).set({ eliminated: 1 }).where(eq(tournamentPlayers.userId, winnerId));
				await db.update(tournaments).set({ status: "ended", winnerId: winnerId}).where(eq(tournaments.id, tournamentId));
			}
			// notify winner tournament won
			// notify others tournament ended
			return; 
		}

		const nextRound = round + 1;
		for (let i = 0; i < winners.length; i += 2) {
			const [match] = await db.insert(matches).values({
				player1Id: Number(winners[i]),
				player2Id: Number(winners[i + 1]),
				status: "ongoing",
			}).returning();

			await db.insert(tournamentMatches).values({
				tournamentId,
				matchId: match.id,
				round: nextRound,
			});
			// notify players new_match (round nextRound)
		}

	} */

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
			return rep.code(STATUS.not_found).send({ message: "No such tournament" });
		}
		
		rep.code(STATUS.success).send({ creator, ...info });
	}

	static async isTournamentMatch(req: FastifyRequest, rep: FastifyReply) {
		const { matchId }= req.query as { matchId: number };

		const [isTmMatch] = await db.select()
			.from(tables.tournamentMatches)
			.where(orm.eq(tables.tournamentMatches.matchId, matchId));	
		
		if (!isTmMatch)
			return rep.code(STATUS.not_found).send({ isTmMatch: false });

		const [tm] = await db.select()
			.from(tables.tournaments)
			.where(orm.eq(tables.tournaments.id,isTmMatch.tournamentId));

		return rep.code(STATUS.success).send({name: tm.name});
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
		const message1 = { service:"tournament", topic: "vs:start", match: match.id, opponent : player2.displayName};
		const message2 = { service:"tournament", topic: "vs:start", match: match.id, opponent : player1.displayName };
		socket.send(player1.uuid, message1);
		socket.send(player2.uuid, message2);
	}
}



export default async function (fastify: FastifyInstance) {
	Tournament.setup(fastify);
	const tournaments = await db.select({ id: tables.tournaments.id }).from(tables.tournaments).where(
		orm.eq(tables.tournaments.status, "pending"),
	);
	for (const tournament of tournaments) {
		dbM.deleteTournament(tournament.id);
	}
}
