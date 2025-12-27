import Fastify, { FastifyInstance } from "fastify"
import auth from "./auth";
import fs from "fs";
import { createTables } from "./db/database"
import user from "./user/user";
import { friendService } from "./user/friend"
import matchmaking from "./game/matchmaking";
import websocketPlugin from "@fastify/websocket";
import matchmakingWS from "./websocket/matchmaking.ws";
import match from "./game/match";
import tournament from "./game/tournament";




async function main() {
	await createTables();

	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		}
	});


	app.register(websocketPlugin);
	app.register(matchmakingWS);
	
	app.register(tournament);
	app.register(auth);
	app.register(user);
	app.register(f => friendService.setup(f));
	app.register(matchmaking);
	app.register(match);

	app.listen({ port: 8080, host: "0.0.0.0" }, function(err, _address) {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();