import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const path = "/srv/app/db/database.sqlite";

const sqlite = new Database(path);
export const db = drizzle(sqlite);
