import * as orm from "drizzle-orm";
import socket from "../socket";
import { db } from "./database";
import * as tables from "./tables";

export async function updateMatchInfo(matchId: number, score_p1: number, score_p2: number) {
	const [match] = await db.select().from(tables.matches).where(orm.eq(tables.matches.id, matchId));
	if (!match) {
		return false;
	}
	if (match.status !== "ongoing") {
		return false;
	}
	await db.update(tables.matches).set({
		scoreP1: score_p1,
		scoreP2: score_p2,
	}).where(orm.eq(tables.matches.id, matchId));
	/*const [tm] = await db.select().from(tables.tournamentMatches).where(
		drizzle.eq(tables.tournamentMatches.matchId, matchId),
	);*/
	// if (tm) {
	// 	await tournamentEndMatch(matchId, winnerId);
	// }
	return true;
}

export async function startMatch(matchId: number): Promise<boolean> {
	const [match] = await db.select().from(tables.matches).where(orm.eq(tables.matches.id, matchId));
	if (!match) {
		return false;
	}
	if (match.status !== "pending") {
		return false;
	}
	await db.update(tables.matches).set({ status: "ongoing" }).where(orm.eq(tables.matches.id, matchId));
	return true;
}

export async function endMatch(matchId: number) {
	// TODO Verif score dans la DB a la fin du match

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
	/*const [tm] = await db.select().from(tables.tournamentMatches).where(
		drizzle.eq(tables.tournamentMatches.matchId, matchId),
	);*/
	// if (tm) {
	// 	await tournamentEndMatch(matchId, winnerId);
	// }
	return true;
}

export async function removeUserFromTournaments(userUUID: string) {
	const tournaments = await db.select({ id: tables.tournamentPlayers.tournamentId }).from(tables.tournamentPlayers)
		.where(orm.eq(tables.tournamentPlayers.userUuid, userUUID));
	const tournamentStates = await db.select({ id: tables.tournaments.id, status: tables.tournaments.status }).from(
		tables.tournaments,
	).where(
		orm.inArray(tables.tournaments.id, tournaments.map((value) => value.id)),
	);
	await db.delete(tables.tournamentPlayers).where(
		orm.and(
			orm.eq(tables.tournamentPlayers.userUuid, userUUID),
			orm.inArray(
				tables.tournamentPlayers.tournamentId,
				tournamentStates.filter((value) => value.status == "pending").map((value) => value.id),
			),
		),
	);
	const [user] = await db.select().from(tables.users).where(
		orm.eq(tables.users.uuid, userUUID),
	);
	// Notify every waiting tournament players of the user leave.
	for (const tournament of tournaments) {
		const players = await selectTournamentPlayers(tournament.id);
		if (players.length == 0) {
			await deleteTournament(tournament.id);
		}
		const message = { service: "tournament", topic: "left", name: user.displayName };
		for (const player of players) {
			socket.send(player.uuid, message);
		}
	}
}

export async function selectTournamentPlayers(id: number) {
	return db.select({
		id: tables.tournamentPlayers.userId,
		uuid: tables.tournamentPlayers.userUuid,
	}).from(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.tournamentId, id),
	);
}

export async function deleteTournament(id: number) {
	await db.delete(tables.tournaments).where(
		orm.eq(tables.tournaments.id, id),
	);
	await db.delete(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.tournamentId, id),
	);
}