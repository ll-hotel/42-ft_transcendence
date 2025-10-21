import { uuid } from "drizzle-orm/gel-core";
import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";



export const users = sqliteTable("users", {
	id: integer("id").primaryKey({autoIncrement : true}),
	uuid: text("uuid").notNull().unique(),
	username: text("username").notNull().unique(),
	password: text("password").notNull(),
	twofaKey: text("twofaKey"),
	twofaEnabled: integer("twofaEnabled").default(0),
	//	email: text("email").notNull().unique(),
});