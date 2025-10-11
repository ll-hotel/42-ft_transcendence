import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { STATUS, MESSAGE } from '../shared';
import { Database } from '../db/database';
import { users as table } from '../db/tables';
import { eq as sql_eq } from 'drizzle-orm';

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

/// Usernames are formed of alphanumerical characters ONLY.
const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;

export class Authentication {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    setup_routes(app: FastifyInstance) {
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

        const users = await this.db.select({ username: table.username }).from(table).where(sql_eq(table.username, username));
        if (users.length !== 0) {
            return rep.code(STATUS.bad_request).send({ message: MESSAGE.already_created });
        }
        return await this.db.insert(table)
            .values({ uuid: uuidv4(), username, password })
            .then(res => {
                console.log(res[0].serverStatus);
                rep.code(STATUS.created).send({ message: MESSAGE.user_created });
            })
            .catch(err => {
                console.log(err);
                rep.code(STATUS.internal_server_error);
            });
    }

    async login(req: FastifyRequest, rep: FastifyReply) {
        const body = req.body as { username: string, password: string };
        const { username, password } = body;
        const users = await this.db.select().from(table).where(sql_eq(table.username, username));
        if (users.length === 0) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_username });
            return;
        }
        if (users[0].password !== password) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_password });
            return;
        }
        if (req.cookies['access_token']) {
            rep.code(STATUS.bad_request).send({ message: MESSAGE.already_logged_in });
            return;
        }
        const access_token = jwt.sign({ uuid: users[0].uuid }, 'secret-key', { expiresIn: '24h' });
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
