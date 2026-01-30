import * as orm from "drizzle-orm";
import { db } from "./db/database";
import * as tables from "./db/tables";
import socket from "./socket";

export async function tcheckFriends(user_1 : number, user_2: number) :Promise<boolean>
	{
		const res = await db.select({id:tables.friends.id }).from(tables.friends).where(orm.and(
				orm.eq(tables.friends.status, "accepted"), 
				orm.or(
					orm.and(
						orm.eq(tables.friends.senderId, user_1),
						orm.eq(tables.friends.receiverId, user_2)
					),
					orm.and(
						orm.eq(tables.friends.senderId,user_2),
						orm.eq(tables.friends.receiverId, user_1)
					)
				)
			)).limit(1);
			return res.length > 0;
	}

export async function createMatch1vs1(uuid1: string, uuid2: string) {
	const [p1] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid1));
	const [p2] = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid2));

	if (!p1 || !p2)
	{
		socket.send(uuid1,{source : "server", service:"chat", topic: "vs:error", content : "User not find ! "});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "User not find !"});
		return;
	}

	if (await !tcheckFriends(p1.id, p2.id))
	{
		socket.send(uuid1,{source : "server",  service:"chat", topic: "vs:error", content : "Users aren't friends anymore !"});
		socket.send(uuid2,{source : "server", service:"chat", topic: "vs:error", content : "Users aren't friends anymore !"});
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

	const [match] = await db.insert(tables.matches).values({
		player1Id : p1.id,
		player2Id : p2.id,
		status: "pending",
	}).returning();

	socket.send(uuid1, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p2.username});
	socket.send(uuid2, {source: "server", service:"chat", topic : "vs:start", match:match.id, opponent : p1.username});

}