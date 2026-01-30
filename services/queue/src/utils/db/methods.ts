import * as orm from "drizzle-orm";
import { db } from "./database";
import * as tables from "./tables";

export async function createMatch(idUser1: number, idUser2: number) {
	const [match] = await db.insert(tables.matches).values({
		player1Id: idUser1,
		player2Id: idUser2,
		status: "pending",
	}).returning();
	return match;
}

export async function removeUserFromQueue(id: number)
{
	const [inQueue] = await db.select()
		.from(tables.matchmakingQueue)
		.where(orm.eq(tables.matchmakingQueue.userId, id))
		
	if (!inQueue) return;

	await db.delete(tables.matchmakingQueue)
		.where(orm.eq(tables.matchmakingQueue.userId, id));
}
