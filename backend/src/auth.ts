import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uiidv4 } from 'uuid';
import { STATUS, MESSAGE } from './shared';
import { users } from './db/tables';
import { db } from './db/database';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword } from './security/hash';
import { generate2FASecret, generateQRCode, verify2FAToken } from './security/2fa';
import fs from "fs";
import { authGuard } from './security/authGuard';
import socket from './socket';

const SCHEMA_REGISTER = {
	body: {
		type: 'object',
		required: ['username', 'password'],
		properties: {
			username: { type: 'string' },
			password: { type: 'string', format: 'password' },
		}
	}
};
const SCHEMA_LOGIN = SCHEMA_REGISTER;

const jwtSecret = fs.readFileSync("/run/secrets/jwt_secret", "utf-8").trim();
const oauthKeys = JSON.parse(fs.readFileSync("/run/secrets/oauthKeys", "utf-8").trim());

if (!process.env.HOSTNAME) {
	throw new Error("Missing server hostname");
}

const redirect42 = `https://${process.env.HOSTNAME}:8443/login?provider=42`;
const redirectGoogle = `https://${process.env.HOSTNAME}:8443/login?provider=google`;

/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class AuthService {
	setup(app: FastifyInstance) {
		app.post('/api/auth/register', { schema: SCHEMA_REGISTER }, this.register);
		app.post('/api/auth/login', { schema: SCHEMA_LOGIN }, this.login);
		app.post('/api/auth/logout', { preHandler: authGuard }, this.logout);
		app.get('/api/auth42', this.auth42Redirect);
		app.get('/api/auth42/callback', this.auth42Callback);
		app.get('/api/authGoogle', this.googleRedirect);
		app.get('/api/authGoogle/callback', this.googleCallback);
	}

	async register(req: FastifyRequest, rep: FastifyReply) {
		const body = req.body as { username: string, password: string, displayName: string, twofa?: boolean };
		const { username, password, displayName, twofa } = body;

		if (REGEX_USERNAME.test(username) === false)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_username });

		if (REGEX_PASSWORD.test(password) === false)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });

		if (REGEX_USERNAME.test(displayName) === false)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName });
		let user_exists = await db.select().from(users).where(eq(users.username, username));
		if (user_exists.length > 0)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.username_taken });
		user_exists = await db.select().from(users).where(eq(users.displayName, displayName));
		if (user_exists.length > 0)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.displayName_taken });

		const hashedPass = await hashPassword(password);
		let twofaKey = null;
		let twofaEnabled = 0;
		let qrCode: string | null = null;

		if (twofa) {
			const secret = generate2FASecret(username);
			if (!secret.otpauth_url)
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.fail_gen2FAurl });
			qrCode = await generateQRCode(secret.otpauth_url);
			twofaKey = secret.base32;
			twofaEnabled = 1;
		}

		await db.insert(users).values({
			uuid: uiidv4(),
			username,
			displayName: username,
			password: hashedPass,
			twofaKey,
			twofaEnabled,
		});

		rep.code(STATUS.created).send({ message: MESSAGE.user_created, qrCode, });
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
		if (user.twofaEnabled) {
			if (!twoFACode) {
				return rep.code(STATUS.bad_request)
					.send({ message: MESSAGE.missing_2FA, twoFAEnabled: true });
			}
			if (!verify2FAToken(user.twofaKey!, twoFACode)) {
				return rep.code(STATUS.unauthorized).send({ message: MESSAGE.invalid_2FA });
			}
		}
		const tokenCookie = req.cookies['accessToken'];
		if (tokenCookie) {
			try {
				jwt.verify(tokenCookie, jwtSecret);
				return rep.code(STATUS.bad_request).send({
					message: MESSAGE.already_logged_in,
					loggedIn: true,
					accessToken: tokenCookie,
				});
			} catch {
//				await db.update(users).set({ isOnline: 0 }).where(eq(users.id, user.id));
				// token expired, process reconnection
			}
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: '1h' });
		rep.setCookie('accessToken', accessToken, {
			httpOnly: true, secure: true, sameSite: 'strict',
			path: "/api"
		});
		rep.code(STATUS.success).send({
			message: MESSAGE.logged_in,
			loggedIn: true,
		});
	};

	async logout(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user;
		if (!user)
			return rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });

		// websocket "disconnect" handler takes care of the user offline status.
		socket.disconnect(user.uuid);

		rep.clearCookie('accessToken', { path: "/api" });
		rep.code(STATUS.success).send({ message: MESSAGE.logged_out, loggedIn: false});
	}


	async auth42Redirect(req: FastifyRequest, rep: FastifyReply) {
		const redirectURL = `https://api.intra.42.fr/oauth/authorize?client_id=${oauthKeys.s42.clientId}&redirect_uri=${encodeURI(redirect42)}&response_type=code`
		rep.send({ redirect: redirectURL });
	}

	async auth42Callback(req: FastifyRequest, rep: FastifyReply) {
		const { code } = req.query as { code?: string };
		if (!code)
			return rep.code(STATUS.bad_request).send({ message: "Missing code " });

		const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
			method: 'POST',
			headers: { 'Content-type': "application/json" },
			body: JSON.stringify({
				grant_type: "authorization_code",
				client_id: oauthKeys.s42.clientId,
				client_secret: oauthKeys.s42.clientSecret,
				code,
				redirect_uri: redirect42,
			})
		});
		const token = await tokenResponse.json();
		if (!token.access_token)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_token });
		const response = await fetch('https://api.intra.42.fr/v2/me', {
			headers: { Authorization: "Bearer " + token.access_token }
		});
		const userData = await response.json();

		const [userExists] = await db.select().from(users).where(eq(users.username, userData.login));
		let user;
		if (userExists)
			user = userExists;
		else {
			const uuid = uiidv4();
			user = { uuid };
			const pass = await hashPassword("42AuthUser____" + uuid);
			await db.insert(users).values({
				uuid,
				username: userData.login,
				displayName: userData.login,
				password: pass,
				// avatar = image?
			});
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: '1h' });
		rep.setCookie('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api' });
		rep.code(STATUS.success).send({
		  	message: MESSAGE.logged_in,
		  	loggedIn: true,
		});
	}

	async googleRedirect(req: FastifyRequest, rep: FastifyReply) {
		const redirectURL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthKeys.google.clientId}&redirect_uri=${encodeURIComponent(redirectGoogle)}&response_type=code&scope=openid email profile`;
		rep.send({ redirect: redirectURL });
	}

	async googleCallback(req: FastifyRequest, rep: FastifyReply) {
		const { code } = req.query as { code?: string };
		if (!code)
			return rep.code(STATUS.bad_request).send({ message: "Missing code " });

		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: 'POST',
			headers: { 'Content-type': "application/json" },
			body: JSON.stringify({
				code,
				client_id: oauthKeys.google.clientId,
				client_secret: oauthKeys.google.clientSecret,
				redirect_uri: redirectGoogle,
				grant_type: "authorization_code",
			})
		});

		const token = await tokenResponse.json();
		if (!token.access_token)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_token });
		const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
			headers: { Authorization: `Bearer ${token.access_token}` }
		});
		const userData = await response.json();
		const [userExists] = await db.select().from(users).where(eq(users.username, userData.email));
		let user;
		if (userExists)
			user = userExists;
		else {
			const uuid = uiidv4();
			user = { uuid };
			const pass = await hashPassword("GoogleUser___" + uuid);
			await db.insert(users).values({
				uuid,
				username: userData.email,
				displayName: userData.given_name,
				password: pass,
				// avatar: userData.picture,
			});
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: '1h' });
		rep.setCookie('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api' });
//		await db.update(users).set({ isOnline: 1 }).where(eq(users.uuid, user.uuid));
		rep.code(STATUS.success).send({
		  	message: MESSAGE.logged_in,
		  	loggedIn: true,
		});
	}
};

const service = new AuthService();

export default function(fastify: FastifyInstance) {
	service.setup(fastify);
}
