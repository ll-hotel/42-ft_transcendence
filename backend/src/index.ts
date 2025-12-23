import Fastify, { FastifyInstance } from "fastify"
import authModule from "./auth";
import { STATUS } from "./shared";
import fs from "fs";
import { createTables } from "./db/database"
import userModule from "./user/user";
import { friendService } from "./user/friend";
import fastifyWebsocket from "@fastify/websocket";
import { chatRoute } from "./routes/chat";

async function main() {
	try {
		await createTables();

		const app: FastifyInstance = Fastify({
			logger: true,
			https: {
				key: fs.readFileSync("/run/secrets/privatekey.pem"),
				cert: fs.readFileSync("/run/secrets/certificate.pem"),
			}
		});
		app.register(authModule);
		app.register(userModule);
		app.register(f => friendService.setup(f));
		app.register(fastifyWebsocket);
		app.register(chatRoute);

		app.get("/ping", (_req, res) => {
			res.code(STATUS.success).send("pong");
		});

		await app.listen({ port: 8080, host: "0.0.0.0" });
	} catch (err) {
		console.log("Could not start server:", err);
		process.exit(1);
	}
}

main();
