import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { v4 as uiidv4 } from "uuid";
import { db } from "./utils/db/database";
import { OAuth, TwofaState, users } from "./utils/db/tables";
import { MESSAGE, schema, STATUS } from "./utils/http-reply";
import { generate2FASecret, generateQRCode, verify2FAToken } from "./utils/security/2fa";
import { authGuard } from "./utils/security/authGuard";
import { comparePassword, hashPassword } from "./utils/security/hash";
import socket from "./utils/socket";

const registerSchema = schema.body({ username: "string", password: "string" }, ["username", "password"]);
const loginSchema = schema.body({ username: "string", password: "string" }, ["username", "password"]);

if (!process.env.OAUTH_KEYS || !process.env.JWT_SECRET || !process.env.HOSTURL) {
	throw new Error("Missing environement value");
}

const jwtSecret = process.env.JWT_SECRET!;
const oauthKeys = JSON.parse(process.env.OAUTH_KEYS!);

const redirect42 = `https://${process.env.HOSTURL}:8443/login?provider=42`;
const redirectGoogle = `https://${process.env.HOSTURL}:8443/login?provider=google`;

/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class AuthService {
	setup(app: FastifyInstance) {
		app.post("/api/auth/register", { schema: registerSchema }, this.register);
		app.post("/api/auth/login", { schema: loginSchema }, this.login);
		app.post("/api/auth/logout", { preHandler: authGuard }, this.logout);
		app.get("/api/auth/42", this.auth42Redirect);
		app.get("/api/auth/42/callback", this.auth42Callback);
		app.get("/api/auth/google", this.googleRedirect);
		app.get("/api/auth/google/callback", this.googleCallback);
	}

	async register(req: FastifyRequest, rep: FastifyReply) {
		const body = req.body as { username: string, password: string };
		const { username, password } = body;

		if (REGEX_USERNAME.test(username) === false) {
			return rep.code(STATUS.bad_request).send({
				message: MESSAGE.invalid_username + ": Must contain 3 minimum characters (alphanumerical only)",
			});
		}

		if (REGEX_PASSWORD.test(password) === false) {
			return rep.code(STATUS.bad_request).send({
				message: MESSAGE.invalid_password
					+ ": Must contain at least 1 lowercase, 1 uppercase and 8 characters minimum",
			});
		}

		let user_exists = (await db.select().from(users).where(eq(users.username, username))).length > 0;
		if (user_exists) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.username_taken });
		}
		user_exists = (await db.select().from(users).where(eq(users.displayName, username))).length > 0;
		if (user_exists) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.displayName_taken });
		}

		const hashedPass = await hashPassword(password);

		await db.insert(users).values({
			uuid: uiidv4(),
			username,
			displayName: username,
			password: hashedPass,
		});

		rep.code(STATUS.created).send({ message: MESSAGE.user_created });
	}

	async login(req: FastifyRequest, rep: FastifyReply) {
		const body = req.body as { username: string, password: string, twoFACode?: string };
		const { username, password, twoFACode } = body;

		const dbQueryResult = await db.select().from(users).where(eq(users.username, username));
		const user = dbQueryResult.length === 0 ? null : dbQueryResult[0];
		if (!user) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_username });
		}

		if (await comparePassword(password, user.password) == false) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });
		}

		if (user.isOnline) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
		}

		if (user.twofaEnabled == TwofaState.enabled) {
			if (!twoFACode) {
				return rep.code(STATUS.bad_request)
					.send({ message: MESSAGE.missing_2FA, twoFAEnabled: true });
			}
			if (!verify2FAToken(user.twofaKey!, twoFACode)) {
				return rep.code(STATUS.unauthorized).send({ message: MESSAGE.invalid_2FA });
			}
		}

		const tokenCookie = req.cookies["accessToken"];
		if (tokenCookie) {
			try {
				jwt.verify(tokenCookie, jwtSecret);
				return rep.code(STATUS.bad_request).send({
					message: MESSAGE.already_logged_in,
					loggedIn: true,
					accessToken: tokenCookie,
				});
			} catch {}
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: "1h" });
		rep.setCookie("accessToken", accessToken, {
			httpOnly: true,
			secure: true,
			sameSite: "strict",
			path: "/api",
		});
		rep.code(STATUS.success).send({
			message: MESSAGE.logged_in,
			loggedIn: true,
		});
	}

	async logout(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user;
		if (!user) {
			return rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });
		}

		// websocket "disconnect" handler takes care of the user offline status.
		socket.disconnect(user.uuid);

		rep.clearCookie("accessToken", { path: "/api" });
		rep.code(STATUS.success).send({ message: MESSAGE.logged_out, loggedIn: false });
	}

	async auth42Redirect(_req: FastifyRequest, rep: FastifyReply) {
		const redirectURL = `https://api.intra.42.fr/oauth/authorize?client_id=${oauthKeys.s42.clientId}&redirect_uri=${
			encodeURI(redirect42)
		}&response_type=code`;
		rep.send({ redirect: redirectURL });
	}

	async auth42Callback(req: FastifyRequest, rep: FastifyReply) {
		const { code } = req.query as { code?: string };
		if (!code) {
			return rep.code(STATUS.bad_request).send({ message: "Missing code " });
		}

		const tokenResponse = await fetch("https://api.intra.42.fr/oauth/token", {
			method: "POST",
			headers: { "Content-type": "application/json" },
			body: JSON.stringify({
				grant_type: "authorization_code",
				client_id: oauthKeys.s42.clientId,
				client_secret: oauthKeys.s42.clientSecret,
				code,
				redirect_uri: redirect42,
			}),
		});
		const token = await tokenResponse.json();
		if (!token.access_token) {
			return rep.code(STATUS.service_unavailable).send({ message: MESSAGE.oauth_service_is_unavailable });
		}
		const response = await fetch("https://api.intra.42.fr/v2/me", {
			headers: { Authorization: "Bearer " + token.access_token },
		});
		const userData = await response.json();

		const [userExists] = await db.select().from(users).where(eq(users.username, userData.login));
		let user;
		if (userExists) {
			user = userExists;
			if (user.isOnline) {
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
			}
		} else {
			const uuid = uiidv4();
			user = { uuid };
			const randomKey = randomBytes(32).toString("hex");
			const pass = await hashPassword(randomKey);
			const res = await fetch(userData.image.versions.medium);
			const buffer = Buffer.from(await res.arrayBuffer());
			const filename = `avatar___${uuid}.png`;
			let avatarPath = "uploads/default_pp.png";
			try {
				avatarPath = `./uploads/${filename}`;
				await sharp(buffer).resize(751, 751, { fit: "cover" }).png().toFile(avatarPath);
			} catch (error) {
				console.log(error);
				avatarPath = "uploads/default_pp.png";
			}
			await db.insert(users).values({
				uuid,
				username: userData.login,
				displayName: userData.login,
				password: pass,
				avatar: avatarPath,
				oauth: OAuth.auth42,
			});
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: "1h" });
		rep.setCookie("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: "strict", path: "/api" });
		rep.code(STATUS.success).send({
			message: MESSAGE.logged_in,
			loggedIn: true,
		});
	}

	async googleRedirect(_req: FastifyRequest, rep: FastifyReply) {
		const redirectURL =
			`https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthKeys.google.clientId}&redirect_uri=${
				encodeURIComponent(redirectGoogle)
			}&response_type=code&scope=openid email profile`;
		rep.send({ redirect: redirectURL });
	}

	async googleCallback(req: FastifyRequest, rep: FastifyReply) {
		const { code } = req.query as { code?: string };
		if (!code) {
			return rep.code(STATUS.bad_request).send({ message: "Missing code " });
		}

		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-type": "application/json" },
			body: JSON.stringify({
				code,
				client_id: oauthKeys.google.clientId,
				client_secret: oauthKeys.google.clientSecret,
				redirect_uri: redirectGoogle,
				grant_type: "authorization_code",
			}),
		});

		const token = await tokenResponse.json();
		if (!token.access_token) {
			return rep.code(STATUS.service_unavailable).send({ message: MESSAGE.oauth_service_is_unavailable });
		}
		const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
			headers: { Authorization: `Bearer ${token.access_token}` },
		});
		const userData = await response.json();
		const [userExists] = await db.select().from(users).where(eq(users.username, userData.email));
		let user;
		if (userExists) {
			user = userExists;
			if (user.isOnline) {
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
			}
		} else {
			const uuid = uiidv4();
			user = { uuid };
			const randomKey = randomBytes(32).toString("hex");
			const pass = await hashPassword(randomKey);
			const res = await fetch(userData.picture);
			const buffer = Buffer.from(await res.arrayBuffer());
			const filename = `avatar___${uuid}.png`;
			let avatarPath = "uploads/default_pp.png";
			try {
				avatarPath = `./uploads/${filename}`;
				await sharp(buffer).resize(751, 751, { fit: "cover" }).png().toFile(avatarPath);
			} catch {
				avatarPath = "uploads/default_pp.png";
			}
			let displayName;
			const displayNameExists = await db.select().from(users).where(eq(users.displayName, userData.given_name));
			if (displayNameExists.length > 0) {
				displayName = userData.email;
			} else {
				displayName = userData.given_name;
			}
			await db.insert(users).values({
				uuid,
				username: userData.email,
				displayName: displayName,
				password: pass,
				avatar: avatarPath,
				oauth: OAuth.google,
			});
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: "1h" });
		rep.setCookie("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: "strict", path: "/api" });
		rep.code(STATUS.success).send({
			message: MESSAGE.logged_in,
			loggedIn: true,
		});
	}
}

const service = new AuthService();

export default function(fastify: FastifyInstance) {
	service.setup(fastify);
}
