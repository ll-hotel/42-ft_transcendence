import { FastifyReply, FastifyRequest } from "fastify";
import { users } from "./db/tables";

export const STATUS = {
    success: 200,
    created: 201,
    bad_request: 400,
    unauthorized: 401,
    not_found: 404,
    internal_server_error: 500,
};

export const MESSAGE = {
    bad_request: 'Bad request',
    unauthorized: 'Unauthorized',
    not_found: 'Not found',
    internal_server_error: 'Internal server error',
    invalid_username: 'Invalid username',
    invalid_password: 'Invalid password',
    invalid_displayName: 'Invalid display name',
    invalid_2FA: 'Invalid 2FA code',
    missing_2FA: 'Missing 2FA code',
    fail_gen2FAurl: 'Failed to generate 2FA URL',
    user_created: 'User created',
    logged_in: 'Logged in',
    already_logged_in: 'Already logged in',
    missing_token: 'Missing token',
    invalid_token: 'Invalid or expired token',
    logged_out: 'Logged out',
    username_taken: 'Username already taken',
    displayName_taken: 'Display name aleready taken',
    user_notfound: 'User not found',
    no_users: 'There is no users',
    database_error: "Database error",
    missing_fields: "Missing fields",
};

export const catch_errors = (fn: any) => async (req: FastifyRequest, rep: FastifyReply) => {
    try {
        await fn(req, rep);
    } catch (error: any) {
        console.error('Error with ', req.method, req.url, ':', error);
        const status = error.status || STATUS.internal_server_error;
        const message = error.message || MESSAGE.internal_server_error;
        rep.code(status).send({ message });
    }
}
