import * as orm from "drizzle-orm";
import { db } from "./db/database";
import * as tables from "./db/tables";
import socket from "./socket";

export async function createMatch1vs1(uuid1: string, uuid2: string) {
	const [p1] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid1));
	const [p2] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid2));

	if (!p1 || !p2)
	{
		socket.send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "User not find ! "});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "User not find !"});
		return;
	}

	const matchAlreadyGoing = await db.select().from(tables.matches).where(orm.and(orm.or(
		orm.eq(tables.matches.player1Id, p1.id),
		orm.eq(tables.matches.player1Id, p2.id),
		orm.eq(tables.matches.player2Id, p1.id),
		orm.eq(tables.matches.player2Id, p2.id),
	),
	orm.or(orm.eq(tables.matches.status, "ongoing"), orm.eq(tables.matches.status, "pending"))
	));

	if (matchAlreadyGoing.length > 0)
	{
		socket.send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a match, sorry :("});
		return;
	}

	const alreadyInQueue = db.select().from(tables.matchmakingQueue).where(orm.or(
		orm.eq(tables.matchmakingQueue.userId, p1.id),
		orm.eq(tables.matchmakingQueue.userId, p2.id))
	).prepare();
	
	if (alreadyInQueue.all().length) {
		socket.send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a queue, sorry :("});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a queue, sorry :("});
		return;
	}

	const alreadyInTournament = db.select().from(tables.tournamentPlayers).where(orm.or(
		orm.eq(tables.tournamentPlayers.userId, p1.id),
		orm.eq(tables.tournamentPlayers.userId, p2.id))
	).prepare();

	if(alreadyInTournament.all().length)
	{
		socket.send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a tournament, sorry :("});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Someone is already on a tournament, sorry :("});
		return;
	}

	const [match] = await db.insert(tables.matches).values({
		player1Id : p1.id,
		player2Id : p2.id,
		status: "pending",
	}).returning();

	socket.send(uuid1, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p2.username});
	socket.send(uuid2, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p1.username});

}