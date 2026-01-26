import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import jwt from "jsonwebtoken";
import { db } from "../db/database";
import { OAuth, User, users } from "../db/tables";
import { MESSAGE, STATUS } from "../http-reply";

declare module "fastify" {
	interface FastifyRequest {
		user?: User;
	}
}

const jwtSecret = fs.readFileSync("/run/secrets/jwt_secret", "utf-8").trim();

export async function authGuard(req: FastifyRequest, rep: FastifyReply) {
	const token = req.cookies ? req.cookies.accessToken : parseCookies(req).get("accessToken");
	if (!token) {
		return rep.code(STATUS.unauthorized).send({ message: MESSAGE.missing_token });
	}
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
	const dbUser = dbUsers[0];
	req.user = {
		...dbUser,
		oauth: dbUser.oauth as OAuth | null,
	};
}

function parseCookies(req: FastifyRequest): Map<string, string> {
	const cookies = new Map<string, string>();
	const words = req.headers["cookie"] ? req.headers["cookie"].split("&") : [];
	const pairs = words.map(w => w.split("="));
	for (const pair of pairs) {
		if (pair.length < 2) continue;
		cookies.set(pair[0], pair[1]);
	}
	return cookies;
}
