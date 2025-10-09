import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import jwt from 'jsonwebtoken';
import { v4 as uiidv4 } from 'uuid';
import { STATUS, MESSAGE } from './shared';

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

type User = { uuid: string, username: string, password: string };

let db: {
    users: User[];
} = { users: [] };

/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;

class AuthService {
    setup(app: FastifyInstance) {
        app.register(cookie, { secret: 'my-secret', parseOptions: {} } as FastifyCookieOptions);
        app.register(formbody);
        app.post('/api/register', { schema: SCHEMA_REGISTER }, this.register);
        app.post('/api/login', { schema: SCHEMA_LOGIN }, this.login);
        app.post('/api/logout', {}, this.logout);
    }

    async register(req: FastifyRequest, rep: FastifyReply) {
        const body = req.body as { username: string, password: string };
        const { username, password } = body;

        if (REGEX_USERNAME.test(username) === false) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_username });
        }
        if (REGEX_PASSWORD.test(password) === false) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });
        }
		if (!db.users.find((e) => { e.username === username })) {
			const user: User = { uuid: uiidv4(), username, password, };
			db.users.push(user);
		}
        rep.code(STATUS.created).send({ message: MESSAGE.user_created, db });
    }

    login(req: FastifyRequest, rep: FastifyReply) {
        const body = req.body as { username: string, password: string };
        const { username, password } = body;
        const user: User | undefined = db.users.find((elt) => { elt.username === username });
        if (!user) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_username });
            return;
        }
        if (user.password !== password) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });
            return;
        }
		if (req.cookies['access_token']) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
            return;
        }
        const access_token = jwt.sign({ uuid: user.uuid }, 'secret-key', { expiresIn: '24h' });
        rep.setCookie('access_token', access_token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
        rep.code(STATUS.success).send({ message: MESSAGE.logged_in });
    };

    logout(req: FastifyRequest, rep: FastifyReply) {
        if (!req.cookies['access_token']) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_token });
            return;
        }
        rep.clearCookie('access_token', { path: '/' });
        rep.code(STATUS.success).send({ message: MESSAGE.logged_out });
    }
};

const service = new AuthService();

interface Auth {
    setup(app: FastifyInstance): void;
}
export const auth = service as Auth;
