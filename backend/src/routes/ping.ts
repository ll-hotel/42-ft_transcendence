import { FastifyInstance } from "fastify";
import { receiveMessageOnPort } from "worker_threads";

export default function (fastify : FastifyInstance) {
	fastify.get("/ping", (req, rep) => { rep.code(200); });
}
