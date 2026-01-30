import * as orm from "drizzle-orm";
import socket from "../socket";
import { db } from "./database";
import * as tables from "./tables";


export async function getUserIdByUsername(username: string): Promise<number | null> {
	const [user] = await db.select({ id: tables.users.id }).from(tables.users).where(orm.eq(tables.users.username, username));
	return user ? user.id : null;
}