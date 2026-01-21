import { FastifyInstance } from "fastify";

export default function(fastify: FastifyInstance) {
	fastify.get("/ping", (req, rep) => {
		rep.code(200);
	});
}
