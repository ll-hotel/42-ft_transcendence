import * as orm from "drizzle-orm";
import { db } from "./database";
import * as tables from "./tables";
import socket from "../socket";

export type TournamentPlayer = {
	id: number,
	uuid: string,
};

/**
 * Inserts a new row in the tournament players table.
 * If the user disconnects and did not reconnect in 10sec, removes him from all tournaments.
 */
export async function addTournamentPlayer(tournamentId: number, user: TournamentPlayer) {
	await db.insert(tables.tournamentPlayers).values({
		tournamentId,
		userId: user.id,
		userUuid: user.uuid,
	});
}

/**
 * Remove user from all tournaments.
 */
export async function removeUserFromTournaments(userUUID: string) {
	const tournaments = await db.select({ id: tables.tournamentPlayers.tournamentId }).from(tables.tournamentPlayers)
		.where(
			orm.eq(tables.tournamentPlayers.userUuid, userUUID),
		);
	await db.delete(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.userUuid, userUUID),
	);
	for (const tournament of tournaments) {
		const players = await selectTournamentPlayers(tournament.id);
		if (players.length == 0) {
			await deleteTournament(tournament.id);
		}
		const [user] = await db.select().from(tables.users).where(
			orm.eq(tables.users.uuid, userUUID)
		);
		const message = { source: "tournament", type: "left", name: user.displayName };
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
