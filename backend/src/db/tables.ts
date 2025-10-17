import { uuid } from "drizzle-orm/gel-core";
import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";



export const users = sqliteTable("users", {
	id: integer("id").primaryKey({autoIncrement : true}),
	uuid: text("uuid").notNull().unique(),
	username: text("username").notNull().unique(),
	password: text("password").notNull(),
	twoFA_key: text("twoFA_key").notNull().unique(),
//	email: text("email").notNull().unique(),
});