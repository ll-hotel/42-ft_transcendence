import fastifyCookie from "@fastify/cookie";
import fastifyWebsocket from "@fastify/websocket";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import { createTables } from "./db/database";
import gameMatch from "./game/match";
import gameQueue from "./game/queue";
import socketRoute from "./routes/socket";
import path from "path";

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
	app.register(socketRoute);

	app.listen({ port: 8080, host: "0.0.0.0" }, (err) => {
		if (err) {
			console.log("Could not start server:", err);
			process.exit(1);
		}
	});
}

main();
