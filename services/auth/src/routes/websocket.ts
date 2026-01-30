import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as WebSocket from "ws";
import { db } from "../utils/db/database";
import * as dbM from "../utils/db/methods";
import * as tables from "../utils/db/tables";
import { schema, STATUS } from "../utils/http-reply";
import socket from "../utils/socket";

export default function(fastify: FastifyInstance): void {
	fastify.get("/websocket", {
		schema: schema.query({ uuid: "string" }, ["uuid"]),
		preHandler: userByUUID,
		websocket: true,
	}, route);
}

function route(ws: WebSocket.WebSocket, req: FastifyRequest): void {
	ws.on("error", (error) => console.log(error));

	socket.connect(req.user!.uuid, ws);
	socket.addListener(req.user!.uuid, "disconnect", () => {
		setTimeout(() => {
			if (socket.isOnline(req.user!.uuid)) {
				return;
			}
			dbM.removeUserFromTournaments(req.user!.uuid);
		}, 1000);
	});
}

async function userByUUID(req: FastifyRequest, rep: FastifyReply) {
	const { uuid } = req.query as { uuid: string };
	if (!uuid) {
		return rep.code(STATUS.unauthorized).send({ message: "Missing user uuid" });
	}
	const dbUsers = await db.select().from(tables.users).where(orm.eq(tables.users.uuid, uuid));
	if (dbUsers.length === 0) {
		return rep.code(STATUS.not_found).send({ message: "No such user" });
	}
	const dbUser = dbUsers[0];
	req.user = {
		...dbUser,
		oauth: dbUser.oauth as tables.OAuth | null,
	};
}

