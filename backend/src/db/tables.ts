import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";



export const users = sqliteTable("users", {
	id: integer("id").primaryKey({autoIncrement : true}),
	uuid: text("uuid").notNull().unique(),
	username: text("username").notNull().unique(),
	displayName: text('displayName').unique().notNull(),
	password: text("password").notNull(),
	avatar: text('avatar').default('DEFAULT_AVATAR').notNull(),
	twofaKey: text("twofaKey"),
	twofaEnabled: integer("twofaEnabled").notNull().default(0),
	isOnline:	integer("isOnline").notNull().default(0),
	//	email: text("email").notNull().unique(),
});


export const friends = sqliteTable("friends", {
	id: integer("id").primaryKey({autoIncrement : true}),
	senderId: integer("senderId").notNull().references(() => users.id, {onDelete: "cascade"}),
	receiverId: integer("receiverId").notNull().references(() => users.id, {onDelete: "cascade"}),
	status: text("status").notNull().default("pending"),
});

export const matchmakingQueue = sqliteTable("matchmakingQueue", {
	id: integer("id").primaryKey({autoIncrement : true}),
	userId: integer("userId").notNull().references(() => users.id, {onDelete: "cascade"}),
});

export const matches = sqliteTable("matches", {
	id: integer("id").primaryKey({autoIncrement : true}),
	player1Id: integer("player1Id").notNull().references(() => users.id, {onDelete: "cascade"}),
	player2Id: integer("player2Id").notNull().references(() => users.id, {onDelete: "cascade"}),
	
	status: text("status").notNull().default("pending"),

	scoreP1: integer("scoreP1").notNull().default(0),
	scoreP2: integer("scoreP2").notNull().default(0),
	winnerId: integer("winnerId").references(() => users.id),
	endedAt: integer("endedAt", {mode : "timestamp"}),

});

