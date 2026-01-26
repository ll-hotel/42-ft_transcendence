import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Do not change this values as they are used inside the database. */
export enum TwofaState {
	disabled = 0,
	enabled = 1,
	pending = 2,
}
/** Do not change this values as they are used inside the database. */
export enum OAuth {
	auth42 = "auth42",
	google = "google",
}

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	uuid: text("uuid").notNull().unique(),
	username: text("username").notNull().unique(),
	displayName: text("displayName").unique().notNull(),
	password: text("password").notNull(),
	avatar: text('avatar').default('uploads/default_pp.png').notNull(),
	twofaKey: text("twofaKey"),
	/** An number with values of the `TwofaState` enum. */
	twofaEnabled: integer("twofaEnabled").notNull().default(TwofaState.disabled),
	isOnline: integer("isOnline").notNull().default(0),
	/** Optional oauth provider. If not null, user was created with 'auth42' or 'google' */
	oauth: text(),
});

export const friends = sqliteTable("friends", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	senderId: integer("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
	receiverId: integer("receiverId").notNull().references(() => users.id, { onDelete: "cascade" }),
	status: text("status").notNull().default("pending"),
});

export const matchmakingQueue = sqliteTable("matchmakingQueue", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const matches = sqliteTable("matches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	player1Id: integer("player1Id").notNull().references(() => users.id, { onDelete: "cascade" }),
	player2Id: integer("player2Id").notNull().references(() => users.id, { onDelete: "cascade" }),

	status: text("status").notNull().default("pending"),

	scoreP1: integer("scoreP1").notNull().default(0),
	scoreP2: integer("scoreP2").notNull().default(0),
	winnerId: integer("winnerId").references(() => users.id),
	endedAt: integer("endedAt"),
});

export const tournaments = sqliteTable("tournaments", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	createdBy: text("createdBy").notNull().references(() => users.uuid),
	size: integer("size").notNull(),
	name: text("name").notNull(),
	status: text("status").notNull().default("pending"),
	winnerId: integer("winnerId").references(() => users.id),
	createdAt: integer("createdAt"),
	round: integer("round"),
});

export const tournamentPlayers = sqliteTable("tournamentPlayers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	tournamentId: integer("tournamentId").notNull().references(() => tournaments.id, { onDelete: "cascade" }),

	userId: integer("userId").notNull().references(() => users.id),
	userUuid: text("userUuid").notNull().references(() => users.uuid),
	eliminated: integer("eliminated").notNull().default(0),
});

export const tournamentMatches = sqliteTable("tournamentMatches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	tournamentId: integer("tournamentId").notNull().references(() => tournaments.id, { onDelete: "cascade" }),

	matchId: integer("matchId").notNull().references(() => matches.id, { onDelete: "cascade" }),
	round: integer("round").notNull(),
});
