import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import userModule from "./user";


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
app.register(fastifyMultipart);
app.register(userModule);

app.listen({ port: 8080, host: "0.0.0.0" }, function(err, _address) {
	if (err) {
		console.log("Could not start server:", err);
		process.exit(1);
	}
});
