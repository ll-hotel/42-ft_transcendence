import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";
import { authGuard } from "./utils/security/authGuard";
import { STATUS } from "./utils/http-reply";
import socket from "./utils/socket";

class Queue {
	static setup(app: FastifyInstance) {
		app.post("/api/queue/join", { preHandler: authGuard }, Queue.joinQueue);
		app.post("/api/queue/leave", { preHandler: authGuard }, Queue.leaveQueue);

		setInterval(async () => {
			while (await Queue.createMatch()) {}
		}, 1000);
	}

	static async joinQueue(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [inQueue] = await db.select().from(tables.matchmakingQueue).where(
			orm.eq(tables.matchmakingQueue.userId, usr.id),
		);
		if (inQueue) {
			return rep.code(STATUS.bad_request).send({ message: "Already in queue" });
		}

		const [isPlaying] = await db.select().from(tables.matches).where(orm.and(
			orm.or(orm.eq(tables.matches.player1Id, usr.id), orm.eq(tables.matches.player2Id, usr.id)),
			orm.or(orm.eq(tables.matches.status, "ongoing"), orm.eq(tables.matches.status, "pending"))
		));
		if (isPlaying) {
			return rep.code(STATUS.bad_request).send({ message: "Already in game" });
		}

		const [alreadyInTournament] = await db.select().from(tables.tournamentPlayers).where(orm.and(
			orm.eq(tables.tournamentPlayers.userId, usr.id),
			orm.eq(tables.tournamentPlayers.eliminated, 0),
		));
		if (alreadyInTournament) {
			const [tm] = await db.select().from(tables.tournaments)
			.where(orm.eq(tables.tournaments.id, alreadyInTournament.tournamentId));
			return rep.code(STATUS.bad_request).send({
				message: "Already in tournament",
				tournamentId: alreadyInTournament.tournamentId,
				name: tm.name,
			});
		}

		await db.insert(tables.matchmakingQueue).values({ userId: usr.id });

		rep.code(STATUS.success).send({ message: "Joined queue" });
	}

	static async createMatch() {
		const players = await db.select({ id: tables.matchmakingQueue.userId }).from(tables.matchmakingQueue).limit(2);
		if (players.length < 2) {
			return false;
		}
		const [player1, player2] = players;
		const match = await dbM.createMatch(player1.id, player2.id);
		await db.delete(tables.matchmakingQueue)
			.where(orm.or(
				orm.eq(tables.matchmakingQueue.userId, player1.id),
				orm.eq(tables.matchmakingQueue.userId, player2.id),
			));
		const [user1] = await db.select().from(tables.users).where(orm.eq(tables.users.id, player1.id));
		const [user2] = await db.select().from(tables.users).where(orm.eq(tables.users.id, player2.id));

		notifyUser(user1.uuid, match.id, user2.username);
		notifyUser(user2.uuid, match.id, user1.username);
		return true;
	}

	static async leaveQueue(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const [player] = await db.select()
			.from(tables.matchmakingQueue)
			.where(orm.eq(tables.matchmakingQueue.userId, usr.id));

		if (!player) {
			return rep.code(400).send({ message: "User not in queue" });
		}

		await db.delete(tables.matchmakingQueue)
			.where(orm.eq(tables.matchmakingQueue.userId, usr.id));

		return rep.code(STATUS.success).send({ message: "Left queue" });
	}
}

export default function(fastify: FastifyInstance) {
	Queue.setup(fastify);
}

function notifyUser(uuid: string, match: number, opponent: string) {
	const message = {
		service: "queue",
		topic: "matchmaking:found",
		match,
		opponent,
	};
	socket.send(uuid, message);
}
