import fastifyCookie from "@fastify/cookie";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import authModule from "./auth";
import { createTables } from "./db/database";
import matchModule from "./game/match";
import matchmakingModule from "./game/matchmaking";
import tournamentModule from "./game/tournament";
import socketRoute from "./socketRoute";
import { friendService } from "./user/friend";
import userModule from "./user/user";

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
	app.register(tournamentModule);
	app.register(matchmakingModule);
	app.register(matchModule);
	app.register(socketRoute);

	app.listen({ port: 8080, host: "0.0.0.0" }, function(err, _address) {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
