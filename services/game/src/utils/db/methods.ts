import * as orm from "drizzle-orm";
import socket from "../socket";
import { db } from "./database";
import * as tables from "./tables";
import { randomBytes } from "crypto";

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
	const [tm] = await db.select().from(tables.tournamentMatches).where(
		orm.eq(tables.tournamentMatches.matchId, matchId),
	);
	if (tm) {
	 	await handleRoundEnd(tm.tournamentId, tm.round);
	}
	return true;
}


export async function handleRoundEnd(tournamentId: number, round: number) {
		const link = await db.select().from(tables.tournamentMatches).where(orm.and(
			orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
			orm.eq(tables.tournamentMatches.round, round)
		));
		const matchIds = link.map((x: any) => x.matchId);
		if (matchIds.length === 0)
			return;
		const roundMatches = await db.select().from(tables.matches).where(orm.inArray(tables.matches.id, matchIds));
		
		const finished = roundMatches.filter((x: any) => x.status === "ended");
		if (finished.length !== roundMatches.length)
			return; // wait for all round's matches to end

		// round ended
		for (let i = 0; i < finished.length; i++) {
			let loserId;
			if (finished[i].winnerId === finished[i].player1Id)
				loserId = finished[i].player2Id;
			else
				loserId = finished[i].player1Id;

			await db.update(tables.tournamentPlayers).set({ eliminated: 1 }).where(orm.and(
				orm.eq(tables.tournamentPlayers.tournamentId, tournamentId),
				orm.eq(tables.tournamentPlayers.userId, loserId),
			));
		}
		const winners = finished
			.map((x: any) => x.winnerId)
			.filter((x: number | null | undefined): x is number => x !== null && x !== undefined);
		if (winners.length === 1) {
			const winnerId = winners[0];
			if (winnerId !== null) {

				await db.update(tables.tournaments)
					.set({ status: "ended", winnerId: winnerId })
					.where(orm.eq(tables.tournaments.id, tournamentId));
				const plyrs = await selectTournamentPlayers(tournamentId);
				await db.delete(tables.tournamentPlayers)
					.where(orm.eq(tables.tournamentPlayers.tournamentId, tournamentId));
				const [winnerUser] = await db.select().from(tables.users).where(orm.eq(tables.users.id, winnerId));
				const winnerName = winnerUser ? winnerUser.displayName : "winner";
				for (const p of plyrs) {
					socket.send(p.uuid, { service: "tournament", topic: "tournament", content: `ended:${winnerName}` });
				}
				
			}

			return; 
		}

		const nextRound = round + 1;
		for (let i = 0; i < winners.length; i += 2) {
			const [match] = await db.insert(tables.matches).values({
				player1Id: Number(winners[i]),
				player2Id: Number(winners[i + 1]),
				status: "pending",
			}).returning();

			await db.insert(tables.tournamentMatches).values({
				tournamentId,
				matchId: match.id,
				round: nextRound,
			});
			const [p1] = await db.select().from(tables.users)
				.where(orm.eq(tables.users.id, match.player1Id));
			const [p2] = await db.select().from(tables.users)
				.where(orm.eq(tables.users.id, match.player2Id));

			if (!p1 || !p2)
				continue;
			const message1 = { service:"tournament", topic: "vs:start", match: match.id, opponent : p2.displayName};
			const message2 = { service:"tournament", topic: "vs:start", match: match.id, opponent : p1.displayName };
			socket.send(p1.uuid, message1);
			socket.send(p2.uuid, message2);

		}
		
		await db.update(tables.tournaments)
			.set({ round: nextRound })
			.where(orm.eq(tables.tournaments.id, tournamentId));

		
		const participants = await selectTournamentPlayers(tournamentId);
		for (const p of participants) {
			socket.send(p.uuid, { service: "tournament", topic: "tournament", content: "update" });
		}

}

export async function removeUserFromTournaments(userUUID: string) {
	const tournaments = await db.select({ id: tables.tournamentPlayers.tournamentId }).from(tables.tournamentPlayers)
		.where(orm.eq(tables.tournamentPlayers.userUuid, userUUID));
	const tournamentStates = await db.select({ id: tables.tournaments.id, status: tables.tournaments.status })
	.from(tables.tournaments)
	.where(orm.inArray(tables.tournaments.id, tournaments.map((value: { id: number }) => value.id)));
	
	await db.delete(tables.tournamentPlayers).
	where(orm.and(
			orm.eq(tables.tournamentPlayers.userUuid, userUUID),
			orm.inArray(
				tables.tournamentPlayers.tournamentId,
				tournamentStates
				.filter((value: { status: string }) => value.status == "pending")
				.map((value: { id: number }) => value.id),
			),
		),
	);
	const [user] = await db.select().from(tables.users).where(
		orm.eq(tables.users.uuid, userUUID),
	);
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

