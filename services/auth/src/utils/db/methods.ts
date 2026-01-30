import * as orm from "drizzle-orm";
import { db } from "./database";
import * as tables from "./tables";

export async function endMatch(matchId: number) {
	const [match] = await db.select().from(tables.matches).where(orm.eq(tables.matches.id, matchId));
	if (!match) {
		return false;
	}
	if (match.status !== "ongoing") {
		return false;
	}
	let winnerId: number;
	if (match.scoreP1 > match.scoreP2) {
		winnerId = match.player1Id;
	} else {
		winnerId = match.player2Id;
	}
	await db.update(tables.matches).set({
		status: "ended",
		winnerId: winnerId,
		endedAt: Date.now(),
	}).where(orm.eq(tables.matches.id, matchId));
	return true;
}