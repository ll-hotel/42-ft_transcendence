import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import { tournaments, tournamentMatches, tournamentPlayers, matches, users } from "../db/tables";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";
import { eq, and, or, inArray} from "drizzle-orm";

export class Tournament {
	static setup(app: FastifyInstance) {
		app.post("/api/tournaments/create", { preHandler: authGuard }, Tournament.createTournament);
		app.post("/api/tournaments/:id/join", { preHandler: authGuard }, Tournament.joinTournament);
		app.post("/api/tournaments/:id/start", { preHandler: authGuard }, Tournament.startTournament);
		
		app.get("/api/tournament/:id/status", { preHandler: authGuard }, Tournament.tournamentStatus);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const { name } = req.body as { name: string };
		
		const [alreadyInTournament] = await db.select().from(tournamentPlayers).where(and(
			eq(tournamentPlayers.userId, usr.id),
			eq(tournamentPlayers.eliminated, 0)
		));
		if (alreadyInTournament)
				return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament "});

		const [tournament] = await db.insert(tournaments).values({
			name,
			createdAt: Date.now(),
		}).returning();

		await db.insert(tournamentPlayers).values({
			tournamentId: tournament.id,
			userId: usr.id,
			displayName: usr.displayName,
		});

		return rep.code(STATUS.created).send({
			message: "Tournament created",
			tournament,
		});
	}

	static async joinTournament(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const {id} = req.params as {id: number};

		const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
		if (!tournament)
			return rep.code(STATUS.not_found).send({ message: "Tournament not found"});
		if (tournament.status !== "pending")
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended" });

		const [alreadyInTournament] = await db.select().from(tournamentPlayers).where(and(
			eq(tournamentPlayers.userId, usr.id),
			eq(tournamentPlayers.eliminated, 0)
		));
		if (alreadyInTournament)
				return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament "});

		const [alreadyInMatch] = await db.select().from(matches).where(and(
			or(eq(matches.player1Id, usr.id), eq(matches.player2Id, usr.id)),
			or(eq(matches.status, "pending"), eq(matches.status, "ongoing"))));
		if (alreadyInMatch)
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match" });

		const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
		if (players.length === 8)
			return rep.code(STATUS.bad_request).send({ message: "Tournament full" });

		await db.insert(tournamentPlayers).values({
			tournamentId: id,
			userId: usr.id,
			displayName: usr.displayName,
		});

		// notify other players usr joined

		return rep.code(STATUS.success).send({ message: "Joined tournament"});
	}

	static async startTournament(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };

		const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
		if (!tournament)
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });
		if (tournament.status !== "pending")
			return rep.code(STATUS.bad_request).send({ message: "Tournament already started or ended" });

		const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id)); 
		if (players.length !== 4 && players.length !== 8) 
			return rep.code(STATUS.bad_request).send({ message: "Not enough players"});

		const round = 1;
		const matchesCreated = [];
		for (let i = 0; i < players.length; i += 2) {
			const [match] = await db.insert(matches).values({
				player1Id: players[i].userId,
				player2Id: players[i + 1].userId,
				status: "ongoing",
			}).returning();

			matchesCreated.push(match);
			await db.insert(tournamentMatches).values({
				tournamentId: id,
				matchId: match.id,
				round,
			});
		}

		await db.update(tournaments).set({status:"ongoing"}).where(eq(tournaments.id, id));
		
		// notify all users TOURNAMENT_STARTED
		// notify users match round 1

		return rep.code(STATUS.success).send({ 
			message: "Tournament started",
			matches: matchesCreated,
		});
	}

	static async tournamentEndMatch(matchId: number, winnerId: number) {
		const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.matchId, matchId));
		if (!tm)
			return;

		// notify match ended
	
		await Tournament.handleRoundEnd(tm.tournamentId, tm.round);
	}

	static async handleRoundEnd(tournamentId: number, round: number) {
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

	}
	
	static async tournamentStatus(req: FastifyRequest, rep: FastifyReply) {
		const { id } = req.params as { id: number };

		const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
		if (!tournament)
			return rep.code(STATUS.not_found).send({ message: "Tournament not found" });

		const playersLink = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
		const players = playersLink.map(x => ({
			userId: x.userId,
			displayName: x.displayName,
			eliminated: x.eliminated,
		}));

		const matchLinks = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
		if (matchLinks.length === 0) {
			return rep.code(STATUS.success).send({
				tournament,
				players,
				rounds : {},
			});
		}
		const matchIds = matchLinks.map(x => x.matchId);
		const allMatches = await db.select().from(matches).where(inArray(matches.id, matchIds));
		const rounds: any = {};


		for (let i = 0; i < matchLinks.length; i++) {
			const match = allMatches.find(x => x.id === matchLinks[i].matchId);
			if (!match)
				continue;
			const p1 = players.find(x => x.userId === match.player1Id);
			const p2 = players.find(x => x.userId === match.player2Id);

			if (!rounds[matchLinks[i].round])
				rounds[matchLinks[i].round] = [];
			rounds[matchLinks[i].round].push({
				matchId: match.id,
				player1: p1 ? p1.displayName : null,
				player2: p2 ? p2.displayName : null,
				status: match.status,
				winnerId: match.winnerId,
				scoreP1: match.scoreP1,
				scoreP2: match.scoreP2,
			});
		}

		return rep.code(STATUS.success).send({
			tournament,
			players,
			rounds
		});


	}
 }

 export default function(fastify: FastifyInstance) {
	Tournament.setup(fastify);
 }