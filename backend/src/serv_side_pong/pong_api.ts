import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {authGuard} from "../security/authGuard";
import {MESSAGE, STATUS} from "../shared";

class PongApi {
	static setup(app: FastifyInstance)
	{
		app.post("/api/pong", {preHandler: authGuard}, (req, res) => {});
	}

	static async getPongInstance(req: FastifyRequest, rep: FastifyReply) {
		if (!req.user) {
			return (rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized }));
		}
		rep.code(STATUS.success).send({
			
		});
	}
}

export default function(fastify: FastifyInstance) {
	PongApi.setup(fastify);
}
