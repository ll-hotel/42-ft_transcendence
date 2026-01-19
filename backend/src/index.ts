import fastifyCookie from "@fastify/cookie";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import { createTables } from "./db/database";
import gameMatch from "./game/match";
import gameQueue from "./game/queue";
import { chatRoute } from "./routes/chat";
import socketRoute from "./routes/socket";
import { friendService } from "./user/friend";
import userModule from "./user/user";

async function main() {
	createTables();

	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		},
	});

	app.register(fastifyCookie);
	app.register(fastifyWebsocket);
	app.register(userModule);
	app.register(f => friendService.setup(f));
	app.register(gameQueue);
	app.register(gameMatch);
	app.register(socketRoute);
	app.register(chatRoute);

	app.listen({ port: 8080, host: "0.0.0.0" }, (err) => {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
