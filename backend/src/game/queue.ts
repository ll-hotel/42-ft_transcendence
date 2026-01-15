import * as drizzle from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import * as tables from "../db/tables";
import { authGuard } from "../security/authGuard";
import { STATUS } from "../shared";
import socket from "../socket";
import { init_game } from "../serv_side_pong/init_lobby";

function notifyUser(uuid: string, match: number, opponent: string) {
	socket.send(uuid, {
		source: "matchmaking",
		type: "found",
		match,
		opponent,
	});
}

class Queue {
	static setup(app: FastifyInstance) {
		app.post("/api/matchmaking/join", { preHandler: authGuard }, Queue.joinQueue);
		app.post("/api/matchmaking/leave", { preHandler: authGuard }, Queue.leaveQueue);

		setInterval(async () => {
			while (await Queue.createMatch()) {}
		}, 1000);
	}

	static async joinQueue(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [inQueue] = await db.select().from(tables.matchmakingQueue).where(
			drizzle.eq(tables.matchmakingQueue.userId, usr.id),
		);
		if (inQueue) {
			return rep.code(STATUS.bad_request).send({ message: "Already in queue" });
		}

		const [isPlaying] = await db.select().from(tables.matches).where(drizzle.and(
			drizzle.or(drizzle.eq(tables.matches.player1Id, usr.id), drizzle.eq(tables.matches.player2Id, usr.id)),
			drizzle.eq(tables.matches.status, "ongoing"),
		));
		if (isPlaying) {
			return rep.code(STATUS.bad_request).send({ message: "Already in game" });
		}

		await db.insert(tables.matchmakingQueue).values({ userId: usr.id });

		rep.code(STATUS.success).send({ message: "Joined queue" });
	}

	static async createMatch() {
		const players = await db.select().from(tables.matchmakingQueue).limit(2);
		if (players.length < 2) {
			return false;
		}
		const [p1, p2] = players;
		const [match] = await db.insert(tables.matches).values({
			player1Id: p1.userId,
			player2Id: p2.userId,
			status: "ongoing",
		}).returning();

		await db.delete(tables.matchmakingQueue)
			.where(drizzle.or(
				drizzle.eq(tables.matchmakingQueue.userId, p1.userId),
				drizzle.eq(tables.matchmakingQueue.userId, p2.userId),
			));

		const [user1] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, p1.userId));
		const [user2] = await db.select().from(tables.users).where(drizzle.eq(tables.users.id, p2.userId));
		notifyUser(user1.uuid, match.id, user2.username);
		notifyUser(user2.uuid, match.id, user1.username);
		init_game(match.id, user1.uuid, user2.uuid);
		return true;
	}

	static async leaveQueue(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [player] = await db.select()
			.from(tables.matchmakingQueue)
			.where(drizzle.eq(tables.matchmakingQueue.userId, usr.id));

		if (!player) {
			return rep.code(400).send({ message: "User not in queue" });
		}

		await db.delete(tables.matchmakingQueue)
			.where(drizzle.eq(tables.matchmakingQueue.userId, usr.id));

		return rep.code(STATUS.success).send({ message: "Left queue" });
	}
}

export default function(fastify: FastifyInstance) {
	Queue.setup(fastify);
}
