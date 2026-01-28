import * as orm from "drizzle-orm";
import socket from "../socket";
import { db } from "./database";
import * as tables from "./tables";

export type TournamentPlayer = {
	id: number,
	uuid: string,
	displayName: string,
};

export async function getUserIdByUsername(username: string): Promise<number | null> {
	const [user] = await db.select({ id: tables.users.id }).from(tables.users).where(orm.eq(tables.users.username, username));
	return user ? user.id : null;
}

export async function setUserOffline(uuid: string) {
	await db.update(tables.users).set({ isOnline: 0 }).where(orm.eq(tables.users.uuid, uuid));
}

export async function addTournamentPlayer(tournamentId: number, user: TournamentPlayer) {
	const [player] = await db.select({ id: tables.tournamentPlayers.userId }).from(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.id, user.id),
	);
	if (player) return;
	await db.insert(tables.tournamentPlayers).values({
		tournamentId,
		userId: user.id,
		userUuid: user.uuid,
	});
	const players = await selectTournamentPlayers(tournamentId);
	const message = { topic: "tournament", type: "join", name: user.displayName };
	for (const player of players) {
		socket.send(player.uuid, message);
	}
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
		const message = { topic: "tournament", type: "left", name: user.displayName };
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

export type TournamentInfo = {
	name: string,
	status: string,
	players: string[],
	rounds: TournamentMatch[][],
};
export type TournamentMatch = {
	matchId: number,
	status: string,
	winner: number | null,
	p1: { name: string, score: number },
	p2: { name: string, score: number },
};
export async function searchTournamentInfo(tournamentId: number): Promise<TournamentInfo | null> {
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
		status: tournament.status,
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
	if (tournament.size == 4) {
		info.rounds.push([]);
	}
	for (let round = 0; Math.pow(2, round) <= tournament.size!; round += 1) {
		const roundMatchs = matchLinks.filter((link) => link.round == round)
			.map((link) => matchs.find((match) => match.matchId == link.matchId)!);
		info.rounds.push(roundMatchs);
	}
	if (info.rounds.length == 2) {
		info.rounds.push([]);
	}
	return info;
}

export enum Error {
	MissingTournament,
	MissingPlayers,
	TournamentNotPending,
}
export async function startTournament(id: number): Promise<Error | null> {
	const [tournament] = await db.select().from(tables.tournaments).where(
		orm.eq(tables.tournaments.id, id),
	);
	if (!tournament) {
		return Error.MissingTournament;
	}
	if (tournament.status !== "pending") {
		return Error.TournamentNotPending;
	}
	const players = await db.select({
		id: tables.tournamentPlayers.userId,
		uuid: tables.tournamentPlayers.userUuid,
	}).from(tables.tournamentPlayers).where(
		orm.eq(tables.tournamentPlayers.tournamentId, id),
	);
	if (players.length < tournament.size) {
		return Error.MissingPlayers;
	}
	for (let i = 0; i + 1 < tournament.size; i += 2) {
		const [match] = await db.insert(tables.matches).values({
			player1Id: players[i].id,
			player2Id: players[i + 1].id,
		}).returning();
		await db.insert(tables.tournamentMatches).values([
			{ tournamentId: tournament.id, matchId: match.id, round: 0 },
		]);
	}
	await db.update(tables.tournaments).set({ status: "ongoing", round: 0 }).where(
		orm.eq(tables.tournaments.id, tournament.id),
	);
	return null;
}

export async function createMatch(idUser1: number, idUser2: number) {
	const [match] = await db.insert(tables.matches).values({
		player1Id: idUser1,
		player2Id: idUser2,
		status: "ongoing",
	}).returning();
	return match;
}
