import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
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


/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class AuthService {
    setup(app: FastifyInstance) {
        app.register(cookie);
        app.register(formbody);
        app.post('/api/register', { schema: SCHEMA_REGISTER }, this.register);
        app.post('/api/login', { schema: SCHEMA_LOGIN }, this.login);
        app.post('/api/logout', {preHandler: authGuard}, this.logout);
    }

    async register(req: FastifyRequest, rep: FastifyReply) {
        const body = req.body as { username: string, password: string, displayName: string, twofa?: boolean};
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
  				return rep.code(STATUS.bad_request).send({ message: MESSAGE.fail_gen2FAurl});
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

        rep.code(STATUS.created).send({message: MESSAGE.user_created, qrCode,});
    }

    async login(req: FastifyRequest, rep: FastifyReply) {
        const body = req.body as { username: string, password: string, token?: string};
        const { username, password, token } = body;

		const result = await db.select().from(users).where(eq(users.username, username));
		if (result.length === 0)
			return rep.code(STATUS.bad_request).send({ message : MESSAGE.invalid_username});

		const user = result[0];
		const validPass = await comparePassword(password, user.password);
        if (!validPass)
            return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });     

		if (user.twofaEnabled === 1) {
			if(!token)
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_2FA});

			const valid2FA = verify2FAToken(user.twofaKey!, token); 
			if (!valid2FA)
				return rep.code(STATUS.unauthorized).send({ message: MESSAGE.invalid_2FA});
		}

		const cookie = req.cookies['access_token'];
		if (cookie){
			try {
				jwt.verify(cookie, jwtSecret);
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
			}
			catch {
				// token expired, process reconnection
			}
		}

		const access_token = jwt.sign({ uuid: user.uuid }, jwtSecret, { expiresIn: '24h' });
		

        rep.setCookie('access_token', access_token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
		await db.update(users).set({isOnline: 1}).where(eq(users.id, user.id));
        rep.code(STATUS.success).send({ message: MESSAGE.logged_in });
    };

    async logout(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user;
		if (!usr)
			return rep.code(STATUS.unauthorized).send({message: MESSAGE.unauthorized});
		
		await db.update(users).set({isOnline: 0}).where(eq(users.id, usr.id));

        rep.clearCookie('access_token', { path: '/' });
        rep.code(STATUS.success).send({ message: MESSAGE.logged_out });
    }
};

const service = new AuthService();

interface Auth {
    setup(app: FastifyInstance): void;
}
export const auth = service as Auth;
