import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { db } from "../db/database";
import { users } from "../db/tables";
import { eq } from "drizzle-orm";
import fs from "fs";
import { STATUS, MESSAGE } from '../shared';


declare module "fastify" {
	interface FastifyRequest {
		user?: {
			id: number;
			uuid: string;
			username: string;
			displayName: string;
			twofaEnabled: number;
			isOnline: number;
			avatar: string;

			// needed data for routes
		};
	}
}

const jwtSecret = fs.readFileSync("/run/secrets/jwt_secret", "utf-8").trim();

export async function authGuard(req: FastifyRequest, rep: FastifyReply) {
	const cookie = req.cookies ? req.cookies.accessToken : undefined;
	console.log("COOKIES = ",req.cookies);
	let token = cookie;
	if (!token)
		return rep.code(STATUS.unauthorized).send({ message: MESSAGE.missing_token });
	let payload: { uuid: string };
	try {
		payload = jwt.verify(token, jwtSecret, {}) as { uuid: string };
	} catch {
		rep.code(STATUS.unauthorized).send({ message: MESSAGE.invalid_token });
		return;
	}
	const dbUsers = await db.select().from(users).where(eq(users.uuid, payload.uuid));
	if (dbUsers.length === 0) {
		return rep.code(STATUS.unauthorized).send({ message: MESSAGE.not_found });
	}
	const user = dbUsers[0];
	req.user = {
		id: user.id,
		uuid: user.uuid,
		username: user.username,
		displayName: user.displayName,
		twofaEnabled: user.twofaEnabled,
		isOnline: user.isOnline,
		avatar: user.avatar,
	}
}	
