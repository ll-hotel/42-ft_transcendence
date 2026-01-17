import {FastifyReply, FastifyRequest} from "fastify";
import {db} from "./database";
import * as tables from "./tables";
import {STATUS} from "../shared";
import * as drizzle from "drizzle-orm";

export async function endMatch(matchId: number) {
	//TODO Verif score dans la DB a la fin du match

	const [match] = await db.select().from(tables.matches).where(drizzle.eq(tables.matches.id, matchId));
	if (!match) {
		return false;
	}
	if (match.status !== "ongoing") {
		return false;
	}
	let winnerId: number;
	if (match.scoreP1 > match.scoreP2)
		winnerId = match.player1Id;
	else
		winnerId = match.player2Id;
	await db.update(tables.matches).set({
		status: "ended",
		winnerId: winnerId,
		endedAt: Date.now(),
	}).where(drizzle.eq(tables.matches.id, matchId));
	/*const [tm] = await db.select().from(tables.tournamentMatches).where(
		drizzle.eq(tables.tournamentMatches.matchId, matchId),
	);*/
	// if (tm) {
	// 	await tournamentEndMatch(matchId, winnerId);
	// }
	return true;
}

export async function updateMatchInfo(matchId: number, score_p1: number, score_p2: number) {

	const [match] = await db.select().from(tables.matches).where(drizzle.eq(tables.matches.id, matchId));
	if (!match) {
		return false;
	}
	if (match.status !== "ongoing") {
		return false;
	}
	await db.update(tables.matches).set({
		scoreP1 : score_p1,
		scoreP2 : score_p2,
	}).where(drizzle.eq(tables.matches.id, matchId));
	/*const [tm] = await db.select().from(tables.tournamentMatches).where(
		drizzle.eq(tables.tournamentMatches.matchId, matchId),
	);*/
	// if (tm) {
	// 	await tournamentEndMatch(matchId, winnerId);
	// }
	return true;
}

