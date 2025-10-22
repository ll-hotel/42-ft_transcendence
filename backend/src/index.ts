import Fastify, { FastifyInstance } from "fastify"
import { auth } from "./auth";
import { STATUS } from "./shared";
import fs from "fs";
import fastifyWebsocket from "@fastify/websocket";
import { liveChatModule } from "./livechat";

const app: FastifyInstance = Fastify({
	logger: true,
	https: {
		key: fs.readFileSync("/run/secrets/privatekey.pem"),
		cert: fs.readFileSync("/run/secrets/certificate.pem"),
	}
});

app.register(fastifyWebsocket);
app.register(liveChatModule);

app.get("/ping", (_req, res) => {
    res.code(STATUS.success).send("pong");
});

auth.setup(app);

app.listen({ port: 8080, host: "0.0.0.0" }, function (err, _address) {
	if (err) {
		console.log("Could not start server:", err);
		process.exit(1);
	}
});
