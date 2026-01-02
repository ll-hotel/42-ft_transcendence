import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import { sql } from "drizzle-orm";


const path = "/srv/app/db/database.sqlite";

const sqlite = new Database(path);
export const db = drizzle(sqlite);

export async function createTables() {
	createUserTable();
	createFriendsTable();
	createMatchmakingQueueTable();
	createMatchesTable();
	createTournamentsTable();
	createTournamentPlayers();
	createTournamentMatches();
}

async function createUserTable() {
	await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
	  displayName TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
	  avatar TEXT NOT NULL DEFAULT 'DEFAULT_AVATAR',
	  twofaKey TEXT,
	  twofaEnabled INTEGER NOT NULL DEFAULT 0,
	  isOnline	INTEGER NOT NULL DEFAULT 0
	  );
	  `);
	}

async function createFriendsTable() {
	await db.run(sql`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
	  receiverId INTEGER NOT NULL,
	  status TEXT NOT NULL DEFAULT 'pending',
	  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
	  FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
	  );
	  `);
}

async function createMatchmakingQueueTable() {
		await db.run(sql`
		CREATE TABLE IF NOT EXISTS matchmakingQueue (
		 id INTEGER PRIMARY KEY AUTOINCREMENT,
		 userId INTEGER NOT NULL,
		 FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);
		`);
}

async function createMatchesTable() {
	await db.run(sql`
	CREATE TABLE IF NOT EXISTS matches (
	 id INTEGER PRIMARY KEY AUTOINCREMENT,
	 player1Id INTEGER NOT NULL, 
	 player2Id INTEGER NOT NULL,
	 winnerId INTEGER,
	 scoreP1 INTEGER DEFAULT 0,
	 scoreP2 INTEGER DEFAULT 0,
	 status TEXT NOT NULL DEFAULT 'pending',
	 endedAt INTEGER,
	 FOREIGN KEY (player1Id) REFERENCES users(id) ON DELETE CASCADE,
	 FOREIGN KEY (player2Id) REFERENCES users(id) ON DELETE CASCADE,
	 FOREIGN KEY (winnerId) REFERENCES users(id) ON DELETE SET NULL
	 );
		`);
}

async function createTournamentsTable() {
	await db.run(sql`
	CREATE TABLE IF NOT EXISTS Tournaments (
	 id INTEGER PRIMARY KEY AUTOINCREMENT,
	 name TEXT NOT NULL,
	 status TEXT NOT NULL DEFAULT 'pending',
	 winnerId INTEGER,
	 createdAt INTEGER,
	 FOREIGN KEY (winnerId) REFERENCES users(id)

	 );
		`);
}

async function createTournamentPlayers() {
	await db.run(sql`
	CREATE TABLE IF NOT EXISTS TournamentPlayers (
	 id INTEGER PRIMARY KEY AUTOINCREMENT,
	 tournamentId INTEGER NOT NULL,
	 userId INTEGER NOT NULL,
	 displayName TEXT NOT NULL,
	 eliminated INTEGER NOT NULL DEFAULT 0,
	 FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE,
	 FOREIGN KEY (userId) REFERENCES users(id)
	 );	
	 `);
}

async function createTournamentMatches() {
	await db.run(sql`
	 CREATE TABLE IF NOT EXISTS TournamentMatches (
	 id INTEGER PRIMARY KEY AUTOINCREMENT,
	 tournamentId INTEGER NOT NULL,
	 matchId INTEGER NOT NULL,
	 round INTEGER NOT NULL,
	 FOREIGN KEY (tournamentId) REFERENCES tournaments(id),
	 FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
	 );`);
}