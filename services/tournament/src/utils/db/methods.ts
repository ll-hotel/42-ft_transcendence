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
		orm.eq(tables.tournamentPlayers.userId, user.id)
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
		orm.inArray(tables.tournaments.id, tournaments.map((value: { id: number }) => value.id)),
	);
	await db.delete(tables.tournamentPlayers).where(
		orm.and(
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
    winner?: string | null,
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
	const info: TournamentInfo = {
		name: tournament.name,
		status: tournament.status,
		players: [],
		rounds: [],
		winner: null,
	};
	const matchLinks = await db.select().from(tables.tournamentMatches).where(
		orm.eq(tables.tournamentMatches.tournamentId, tournamentId),
	);
	if (matchLinks.length === 0) {
		// No matches yet: use waiting list from tournamentPlayers
		const waitingUsers = await db.select().from(tables.users).where(
			orm.inArray(tables.users.id, playerLinks.map((link: { userId: number }) => link.userId)),
		);
		info.players = waitingUsers.map((player: { displayName: string }) => player.displayName);
		if (tournament.winnerId) {
			const [winnerUser] = await db.select().from(tables.users).where(orm.eq(tables.users.id, tournament.winnerId));
			info.winner = winnerUser ? winnerUser.displayName : null;
		}
		return info;
	}

	const matchIds = matchLinks.map((x: { matchId: number }) => x.matchId);
	const dbMatchs = await db.select().from(tables.matches).where(orm.inArray(tables.matches.id, matchIds));
	// Derive unique player IDs from matches and fetch their profiles
	const uniquePlayerIds = Array.from(new Set(
		dbMatchs.flatMap((m: { player1Id: number, player2Id: number }) => [m.player1Id, m.player2Id])
	));
	const players = await db.select().from(tables.users).where(
		orm.inArray(tables.users.id, uniquePlayerIds),
	);
	info.players = players.map((p: { displayName: string }) => p.displayName);

	const matchs: TournamentMatch[] = dbMatchs.map((match: { id: number, status: string, winnerId: number | null, player1Id: number, player2Id: number, scoreP1: number, scoreP2: number }) => {
		const player1 = players.find((player: { id: number }) => player.id == match.player1Id);
		const player2 = players.find((player: { id: number }) => player.id == match.player2Id);
		let winner: number | null = null;
		if (match.winnerId) {
			winner = player1 && player1.id == match.winnerId ? 1 : 2;
		}
		return {
			matchId: match.id,
			status: match.status,
			winner,
			p1: { name: (players.find((p: { id: number, displayName: string }) => p.id === match.player1Id) || { displayName: "" }).displayName, score: match.scoreP1 },
			p2: { name: (players.find((p: { id: number, displayName: string }) => p.id === match.player2Id) || { displayName: "" }).displayName, score: match.scoreP2 },
		};
	});

	info.rounds = [];
	const roundsCount = Math.log2(tournament.size!);
	if (tournament.size == 4) {
		// Keep a leading placeholder to align with 3 containers (round-0, round-1, round-2)
		info.rounds.push([]);
	}
	for (let round = 0; round < roundsCount; round += 1) {
		const roundLinks = matchLinks.filter((link: { round: number }) => link.round == round);
		const roundMatchs = roundLinks
			.map((link: { matchId: number }) => matchs.find((match: TournamentMatch) => match.matchId == link.matchId))
			.filter((m: TournamentMatch | undefined): m is TournamentMatch => !!m);
		info.rounds.push(roundMatchs);
	}
	// If exactly 2 arrays (for size 4 without placeholder), add one to align with UI; else leave as is
	if (info.rounds.length == 2) {
		info.rounds.push([]);
	}

	if (tournament.status === "ended" && tournament.winnerId) {
		const [winnerUser] = await db.select().from(tables.users).where(orm.eq(tables.users.id, tournament.winnerId));
		info.winner = winnerUser ? winnerUser.displayName : null;
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
