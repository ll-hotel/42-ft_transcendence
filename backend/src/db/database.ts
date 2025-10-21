import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import { sql } from "drizzle-orm";


const path = "/srv/app/db/database.sqlite";

const sqlite = new Database(path);
export const db = drizzle(sqlite);

export async function createTable() {
	await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
	  twofaKey TEXT,
	  twofaEnabled INTEGER DEFAULT 0
	  );
	  `);
	}
	
	// email    TEXT UNIQUE NOT NULL
	//twofaEnabled INTEGER NOT NULL DEFAULT 0