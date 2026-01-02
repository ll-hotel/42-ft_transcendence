import fs from "fs";
import Fastify, { FastifyInstance } from "fastify"
import fastifyWebsocket from "@fastify/websocket";
import fastifyCookie from '@fastify/cookie';
import { createTables } from "./db/database"
import { friendService } from "./user/friend"
import authModule from "./auth";
import userModule from "./user/user";
import matchmakingModule from "./game/matchmaking";
import matchModule from "./game/match";
import tournamentModule from "./game/tournament";
import matchmakingWS from "./websocket/matchmaking.ws";
import socketRoute from "./socketRoute";

async function main() {
	await createTables();

	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		}
	});

	app.register(fastifyCookie);
	app.register(fastifyWebsocket);
	app.register(authModule);
	app.register(userModule);
	app.register(f => friendService.setup(f));
	// app.register(tournamentModule);
	// app.register(matchmakingModule);
	// app.register(matchmakingWS);
	// app.register(matchModule);
	app.register(socketRoute);

	app.listen({ port: 8080, host: "0.0.0.0" }, function(err, _address) {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
