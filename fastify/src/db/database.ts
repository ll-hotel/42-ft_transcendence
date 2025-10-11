import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2";

export type Database = MySql2Database<Record<string, never>> & {
	$client: Pool;
};

export function setup_db(): Database {
	const db = drizzle({
		connection: {
			host: process.env.DB_HOST,
			user: process.env.DB_USER_NAME,
			password: process.env.DB_USER_PASSWORD,
		}
	});
	return db;
}
