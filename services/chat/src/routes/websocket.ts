import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as WebSocket from "ws";
import { chat } from "../chat";
import { db } from "../utils/db/database";
import * as tables from "../utils/db/tables";
import { schema, STATUS } from "../utils/http-reply";
import socketPool, { Message} from "../utils/socket";
import { createMatch1vs1 } from "../utils/versus";

export default function(fastify: FastifyInstance): void {
	fastify.get("/websocket", {
		schema: schema.query({ uuid: "string" }, ["uuid"]),
		preHandler: userByUUID,
		websocket: true,
	}, route);
}

function route(ws: WebSocket.WebSocket, req: FastifyRequest): void {
	ws.on("error", (error) => console.log(error));

	socketPool.connect(req.user!.uuid, ws);
	chat.newWebsocketConnection(ws, req);
	socketPool.addListener(req.user!.uuid, "vs:invite", async (mess : Message) => {
		if (!("content" in mess))
			return;
		if (socketPool.isOnline(mess.content))
		{
			const [displaySender] = await db.select({displayName: tables.users.displayName}).from(tables.users).where(orm.eq(tables.users.id, req.user!.id))
			if (!displaySender) return;
			socketPool.send(mess.content, { service: "chat", topic: "vs:invite", source: req.user!.uuid, content: displaySender.displayName});
		} else {
			const [displayReceiver] = await db.select({displayName: tables.users.displayName}).from(tables.users).where(orm.eq(tables.users.uuid, mess.content))
			if (!displayReceiver) return;
			socketPool.send(req.user!.uuid, { source : "chat", service: "chat", topic: "vs:decline", content: displayReceiver.displayName})
		}
	});
	socketPool.addListener(req.user!.uuid, "vs:accept", (mess : Message) => {
		if ("content" in mess)
			createMatch1vs1(req.user!.uuid, mess.content);
	});
	socketPool.addListener(req.user!.uuid, "vs:decline", async (mess : Message) => {
		if ("content" in mess) {
			socketPool.send(mess.content, { source : req.user!.uuid, topic : "vs:decline", service : "chat", content: req.user!.displayName });
		}
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
