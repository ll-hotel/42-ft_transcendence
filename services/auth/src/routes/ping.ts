import { FastifyInstance } from "fastify";
import { authGuard } from "../utils/security/authGuard";
import { STATUS } from "../utils/http-reply";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/auth/ping", { preHandler: authGuard }, (_, rep) => {
		rep.code(STATUS.success).send({ message: "pong" });
	});
}
