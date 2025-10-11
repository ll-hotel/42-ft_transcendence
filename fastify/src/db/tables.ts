import { mysqlTable as table } from "drizzle-orm/mysql-core";
import * as t from "drizzle-orm/mysql-core";

export const users = table("users", {
	id: t.serial().primaryKey(),
	uuid: t.varchar({ length: 255 }).unique().notNull(),
	username: t.varchar({ length: 255 }).notNull(),
	password: t.varchar({ length: 255 }).notNull(),
	created_at: t.datetime().notNull().$defaultFn(() => new Date),
});
