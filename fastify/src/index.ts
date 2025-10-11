import Fastify, { FastifyInstance } from "fastify"
import fs from "fs";
import { Authentication } from "./user/login";
import { setup_db } from "./db/database";
import { STATUS } from "./shared";

async function main(): Promise<void> {
	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		}
	});

	app.get("/ping", (_req, res) => {
		res.code(STATUS.success).send("pong");
	});

	console.log({
		host: process.env.DB_HOST,
		user: process.env.DB_USER_NAME,
		password: process.env.DB_USER_PASSWORD,
	});
	const db = setup_db();
	if (!db || !db.select) {
		console.log("Could not init database");
		process.exit(1);
	}
	const auth = new Authentication(db);
	auth.setup_routes(app);
	app.listen({ port: 8080, host: "0.0.0.0" }, function (err, _address) {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
