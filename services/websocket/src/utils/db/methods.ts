import * as orm from "drizzle-orm";
import { db } from "./database";
import * as tables from "./tables";

export async function setUserOffline(uuid: string) {
	await db.update(tables.users).set({ isOnline: 0 }).where(orm.eq(tables.users.uuid, uuid));
}
