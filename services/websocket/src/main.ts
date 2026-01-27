import fastifyCookie from "@fastify/cookie";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import websocketRoute from "./routes/websocket";

const app: FastifyInstance = Fastify({
	logger: true,
	https: {
		key: fs.readFileSync("/run/secrets/privatekey.pem"),
		cert: fs.readFileSync("/run/secrets/certificate.pem"),
	},
});

app.register(fastifyCookie);
app.register(fastifyWebsocket);
app.register(websocketRoute);

app.listen({ port: 8080, host: "0.0.0.0" }, function (err, _address) {
	if (err) {
		console.log("Could not start server:", err);
		process.exit(1);
	}
});
