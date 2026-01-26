import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import { createTables } from "./db/database";
import gameMatch from "./game/match";
import gameQueue from "./game/queue";
import path from "path";
import pingRoute from "./routes/ping";

async function main() {
	createTables();

	const app: FastifyInstance = Fastify({
		logger: true,
		https: {
			key: fs.readFileSync("/run/secrets/privatekey.pem"),
			cert: fs.readFileSync("/run/secrets/certificate.pem"),
		},
	});

	app.register(fastifyStatic, {
		root: path.join(__dirname, "..", "uploads"),
		prefix: "/uploads/",
	});

	app.register(fastifyCookie);
	app.register(fastifyWebsocket);
	app.register(fastifyMultipart);
	app.register(gameQueue);
	app.register(gameMatch);
	app.register(pingRoute);

	app.listen({ port: 8080, host: "0.0.0.0" }, (err) => {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
