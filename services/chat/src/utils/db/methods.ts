import * as orm from "drizzle-orm";
import { db } from "./database";
import * as tables from "./tables";


/** { username: string } */
export const userIdByUsername = db.select({ id: tables.users.id }).from(tables.users).where(
	orm.eq(tables.users.username, orm.sql.placeholder("username")),
).prepare();

/** { userId: number, otherId: number } */
export const userBlocked = db.select({ status: tables.friends.status }).from(tables.friends).where(
	orm.and(
		orm.and(
			orm.eq(tables.friends.receiverId, orm.sql.placeholder("userId")),
			orm.eq(tables.friends.senderId, orm.sql.placeholder("otherId")),
		),
		orm.eq(tables.friends.status, "block"),
	),
).prepare();
