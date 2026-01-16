import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as dbM from "../db/methods";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import socket from "../socket";

export default function(fastify: FastifyInstance) {
	fastify.get("/api/websocket", { preHandler: authGuard, websocket: true }, route);
}

async function route(ws: WebSocket, req: FastifyRequest) {
	const uuid = req.user!.uuid;

	const isNewClient = socket.clients.get(uuid) === undefined;
	socket.connect(uuid, ws);

	db.update(tables.users).set({ isOnline: 1 }).where(orm.eq(tables.users.uuid, uuid));

	if (isNewClient === false) {
		return;
	}
	socket.addListener(uuid, "disconnect", () => {
		const checkOfflineDuration = () => {
			if (socket.isOnline(uuid)) {
				return;
			}
			const client = socket.clients.get(uuid);
			if (!client) {
				return;
			}
			const offlineDuration = Date.now() - client.lastOnlineTime;
			// Since client sends a ping message with a 4sec interval, let's add double that and add 2.
			if (offlineDuration <= 10) {
				setTimeout(checkOfflineDuration, 1000);
				return;
			}
			dbM.removeUserFromTournaments(uuid);
			if (client.sockets.length == 0) {
				db.update(tables.users).set({ isOnline: 0 }).where(orm.eq(tables.users.uuid, uuid));
			}
		};
		checkOfflineDuration();
	});
}
