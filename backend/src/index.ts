import fastifyCookie from "@fastify/cookie";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import authModule from "./auth";
import { createTables } from "./db/database";
import gameMatch from "./game/match";
import gameQueue from "./game/queue";
import gameTournament from "./game/tournament";
import socketRoute from "./socketRoute";
import { friendService } from "./user/friend";
import userModule from "./user/user";
import { STATUS } from "./shared";

async function main() {
	await createTables();

	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		},
	});

	app.register(fastifyCookie);
	app.register(fastifyWebsocket);
	app.register(authModule);
	app.register(userModule);
	app.register(f => friendService.setup(f));
	app.register(gameTournament);
	app.register(gameQueue);
	app.register(gameMatch);
	app.register(socketRoute);

	app.get("/ping", (_req, res) => {
		res.code(STATUS.success).send("pong");
	});

	app.listen({ port: 8080, host: "0.0.0.0" }, function(err, _address) {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
