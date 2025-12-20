import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import { tournaments, tournamentMatches, tournamentPlayers, matches } from "../db/tables";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";
import { eq, and, or} from "drizzle-orm";

export class Tournament {
	static setup(app: FastifyInstance) {
		app.post("/api/tournaments/create", { preHandler: authGuard }, Tournament.createTournament);
		app.post("/api/tournaments/:id/join", { preHandler: authGuard }, Tournament.joinTournament);
		app.post("/api/tournaments/:id/start", { preHandler: authGuard }, Tournament.startTournament);
	}

	static async createTournament(req: FastifyRequest, rep: FastifyReply) {
		const { name } = req.body as { name: string };
		
		// 


		const [tournament] = await db.insert(tournaments).values({
			name,
			createdAt: Date.now(),
		}).returning();

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

		const [alreadyInTournament] = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.userId, usr.id));
		if (alreadyInTournament)
				return rep.code(STATUS.bad_request).send({ message: "You are already in a Tournament "});

		const [alreadyInMatch] = await db.select().from(matches).where(and(
			or(eq(matches.player1Id, usr.id), eq(matches.player2Id, usr.id)),
			or(eq(matches.status, "pending"), eq(matches.status, "ongoing"))));
		if (alreadyInMatch)
			return rep.code(STATUS.bad_request).send({ message: "You are already in a match" });

		const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
		if (players.length >= 4)
			return rep.code(STATUS.bad_request).send({ message: "Tournament full" });

		await db.insert(tournamentPlayers).values({
			tournamentId: id,
			userId: usr.id,
		});

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
		if (players.length !== 4) 
			return rep.code(STATUS.bad_request).send({ message: "Not enough players"});
		
		const [m1] = await db.insert(matches).values({
			player1Id: players[0].userId,
			player2Id: players[1].userId,
			status: "ongoing",
		}).returning();
		const [m2] = await db.insert(matches).values({
			player1Id: players[2].userId,
			player2Id: players[3].userId,
			status: "ongoing",
		}).returning();

		await db.insert(tournamentMatches).values([
			{ tournamentId: id, matchId: m1.id, round: 1},
			{ tournamentId: id, matchId: m2.id, round: 1}
		]);

		await db.update(tournaments).set({status:"ongoing"}).where(eq(tournaments.id, id));

		return rep.code(STATUS.success).send({ 
			message: "Tournament started",
			matches: [m1, m2],
		});
	}

	static async tournamentEndMatch(matchId: number, winnerId: number) {
		const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.matchId, matchId));
		if (!tm)
			return;
		if (tm.round === 1) 
			await Tournament.semiFinalEnd(tm.tournamentId);
		else if (tm.round === 2) 
			await db.update(tournaments).set({status: "ended"}).where(eq(tournaments.id, tm.tournamentId));
	}

	static async semiFinalEnd(tournamentId: number) {
		const link = await db.select().from(tournamentMatches).where(and(
			eq(tournamentMatches.tournamentId), tournamentId, 
			eq(tournamentMatches.round, 1)));

		if (link.length !== 2)
			return;
		
		const semiMatches = await db.select().from(matches).where(or(
			eq(matches.id, link[0].matchId),
			eq(matches.id, link[1].matchId)
		));

		const finished = semiMatches.filter(x => x.status === "ended");
		if (finished.length < 2)
			return;

		const winner1 = finished[0].winnerId;
		const winner2 = finished[1].winnerId;

		const [finalMatch] = await db.insert(matches).values({
			player1Id: winner1,
			player2Id: winner2,
			status: "ongoing",
		}).returning();

		await db.insert(tournamentMatches).values({
			tournamentId,
			matchId: finalMatch.id,
			round: 2,
		});

	}
 }

 export default function(fastify: FastifyInstance) {
	Tournament.setup(fastify);
 }