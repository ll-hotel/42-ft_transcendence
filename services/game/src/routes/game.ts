import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../utils/db/database";
import * as tables from "../utils/db/tables";
import { games as serverGames } from "../serverside";
import {InputMessage, LocalMessage, Mode} from "../types";
import { authGuard } from "../utils/security/authGuard";
import { MESSAGE, schema, STATUS } from "../utils/http-reply";

const stateSchema = schema.query({ matchId: "number" }, ["matchId"]);
const inputSchema = schema.body({ 
	matchId: "number",
	clientId: "string",
	p1_up: "boolean",
	p1_down: "boolean",
	p2_up: "boolean",
	p2_down: "boolean",
	}, ["gameId", "p1_up", "p1_down"]);

export default function(fastify: FastifyInstance) {
	fastify.get("/api/game/state", { preHandler: authGuard, schema: stateSchema }, getState);
	fastify.post("/api/game/input", { preHandler: authGuard, schema: inputSchema }, postInput);
}

async function getState(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const query = request.query as { matchId: number };

	const matchById = db.select().from(tables.matches).where(orm.eq(tables.matches.id, orm.sql.placeholder("id")))
		.prepare();

	const match = matchById.get({ id: query.matchId });
	if (match == undefined) {
		return reply.code(STATUS.not_found).send({ message: "Match not found" });
	}

	const game = serverGames.get(query.matchId);
	if (game == undefined) {
		return reply.code(STATUS.bad_request).send({ message: "Match ended" });
	}

	if (game.p1_uuid != request.user!.uuid && game.p2_uuid != request.user!.uuid) {
		return reply.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });
	}

	const gameState = game.state();
	return reply.code(STATUS.success).send(gameState);
}

async function postInput(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	if (!request.user)
		return reply.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });
	const body = request.body as {
		gameId: number,
		clientId: string,
		p1_up: boolean,
		p1_down: boolean,
		p2_up?: boolean,
		p2_down?: boolean,
	};

	const matchById = db.select().from(tables.matches).where(orm.eq(tables.matches.id, orm.sql.placeholder("id")))
		.prepare();

	const match = matchById.get({ id: body.gameId });
	if (match == undefined) {
		return reply.code(STATUS.not_found).send({ message: "Match not found" });
	}

	const game = serverGames.get(body.gameId);
	if (game == undefined) {
		return reply.code(STATUS.bad_request).send({ message: "Match ended" });
	}

	if (game.mode != Mode.local && (body.p2_up != undefined || body.p2_down != undefined)) {
		return reply.code(STATUS.bad_request).send({ message: "This is not a local match" });
	}
	if (game.mode == Mode.local && (body.p2_up == undefined || body.p2_down == undefined)) {
		return reply.code(STATUS.bad_request).send({ message: "Missing player 2 inputs" });
	}

	if (game.mode == Mode.local) {
		const messageLocal: LocalMessage = {
			service : "game",
			topic: "pong",
			type: "input",
			p1_up: body.p1_up,
			p1_down: body.p1_down,
			p2_up: body.p2_up!,
			p2_down: body.p2_down!,
		};
		game.local_input_listener(messageLocal);
	}
	else{
		const messageP1: InputMessage = {
			service: "game",
			topic: "pong",
			type: "input",
			clientId: request.user.uuid,
			up: body.p1_up,
			down: body.p1_down,
		};
		game.remote_input_listener(messageP1);
	}

	return reply.code(STATUS.success).send({message: "input received"});
}
