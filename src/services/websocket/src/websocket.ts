import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";
import { authGuard } from "./utils/security/authGuard";
import socket from "./utils/socket";
import { table } from "console";

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
	});
}
