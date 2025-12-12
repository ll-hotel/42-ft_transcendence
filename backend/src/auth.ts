import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
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
const UID = fs.readFileSync("/run/secrets/uid_42", "utf-8").trim();
const clientSecret = fs.readFileSync("/run/secrets/client42_secret", "utf-8").trim();
const redirectURI = `https://localhost:8443/login`

/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class AuthService {
	setup(app: FastifyInstance) {
		app.register(fastifyCookie);
		app.post('/api/auth/register', { schema: SCHEMA_REGISTER }, this.register);
		app.post('/api/auth/login', { schema: SCHEMA_LOGIN }, this.login);
		app.post('/api/auth/logout', { preHandler: authGuard }, this.logout);
		app.get('/api/auth42', this.redirectAuth42);
		app.get('/api/auth42/callback', this.callback); 
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
			displayName,
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
		/* if (user.isOnline === 1)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in }); */
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
				// token expired, process reconnection
			}
		}
		const accessToken = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: '1h' });
		await db.update(users).set({ isOnline: 1 }).where(eq(users.id, user.id));
		rep.setCookie('accessToken', accessToken, {
			httpOnly: true, secure: true, sameSite: 'strict',
			path: "/api"
		});
		rep.code(STATUS.success).send({
			message: MESSAGE.logged_in,
			loggedIn: true,
			accessToken,
		});
	};

	async logout(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user;
		if (!user)
			return rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });

		await db.update(users).set({ isOnline: 0 }).where(eq(users.id, user.id));

		rep.clearCookie('accessToken', { path: "/api" });
		rep.code(STATUS.success).send({ message: MESSAGE.logged_out });
	}

	async redirectAuth42(req: FastifyRequest, rep: FastifyReply) {
		const redirectURL = `https://api.intra.42.fr/oauth/authorize?client_id=${UID}&redirect_uri=${encodeURI(redirectURI)}&response_type=code`
		rep.send({ redirect: redirectURL });
	}

	async callback(req: FastifyRequest, rep: FastifyReply) {
		const {code} = req.query as {code?: string};
		if (!code)
			return rep.code(STATUS.bad_request).send({ message: "Missing code "});

		const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token',{
			method: 'POST',
			headers: {'Content-type': "application/json"},
			body: JSON.stringify({
				grant_type: "authorization_code",
				client_id: UID,
				client_secret: clientSecret,
				code,
				redirect_uri: redirectURI,

			})
		});
		const token = await tokenResponse.json();
		if (!token.access_token)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_token });
		const response = await fetch('https://api.intra.42.fr/v2/me',{
			headers: {Authorization: "Bearer " + token.access_token}
		});
		const userData = await response.json();

		const [userExists] = await db.select().from(users).where(eq(users.username, userData.login));
		let user;
		if (userExists)
			user = userExists;
		else {
			const uuid = uiidv4();
			user = {uuid};
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
		await db.update(users).set({ isOnline: 1 }).where(eq(users.uuid, user.uuid));

		
		rep.code(STATUS.success).send({
		  	message: MESSAGE.logged_in,
		  	loggedIn: true,
		  	accessToken,
		});
	}
};

const service = new AuthService();

export default function(fastify: FastifyInstance) {
	service.setup(fastify);
}
