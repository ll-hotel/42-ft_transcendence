import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { db } from "../db/database";
import { users } from "../db/tables";
import { eq } from "drizzle-orm";
import fs from "fs";
import { STATUS, MESSAGE } from '../http-reply';


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
	const token = req.cookies ? req.cookies.accessToken : parseCookies(req).get("accessToken");
	if (!token)
		return rep.code(STATUS.unauthorized).send({ message: MESSAGE.missing_token });
	let payload: { uuid: string };
	try {
		payload = jwt.verify(token, jwtSecret, {}) as { uuid: string };
	} catch {
		rep.clearCookie("accessToken", { path: "/api" });
		rep.code(STATUS.unauthorized).send({ message: MESSAGE.invalid_token });
		return;
	}
	const dbUsers = await db.select().from(users).where(eq(users.uuid, payload.uuid));
	if (dbUsers.length === 0) {
		rep.clearCookie("accessToken", { path: "/api" });
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

function parseCookies(req: FastifyRequest): Map<string, string> {
	const cookies = new Map<string, string>;
	const words = req.headers["cookie"] ? req.headers["cookie"].split("&") : [];
	const pairs = words.map(w => w.split("="));
	for (const pair of pairs) {
		if (pair.length < 2) continue;
		cookies.set(pair[0], pair[1]);
	}
	return cookies;
}
