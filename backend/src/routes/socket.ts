import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyRequest, FastifyReply, } from "fastify";
import { db } from "../db/database";
import * as dbM from "../db/methods";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import socket from "../socket";
import { table } from "console";
import Queue from "../game/queue";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

async function route(ws: WebSocket, req: FastifyRequest) {
	const uuid = req.user!.uuid;

	const isNewClient = socket.clients.get(uuid) === undefined;
	socket.connect(uuid, ws);

	await db.update(tables.users).set({ isOnline: 1 }).where(orm.eq(tables.users.uuid, uuid));
	
	if (isNewClient === false) {
		return;
	}
	socket.addListener(uuid, "disconnect", () => {
		setTimeout(() => {
			if (socket.isOnline(uuid)) {
				return;
			}
			dbM.removeUserFromTournaments(uuid);
			dbM.setUserOffline(uuid);
		}, 2000);
		dbM.removeUserFromQueue(uuid);
	});
}
