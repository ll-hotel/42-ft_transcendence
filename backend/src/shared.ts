import { FastifyReply, FastifyRequest } from "fastify";

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
	invalid_2FA: 'Invalid 2FA code',
	missing_2FA: 'Missing 2FA code',
	fail_gen2FAurl: 'Failed to generate 2FA URL',
    user_created: 'User created',
    logged_in: 'Logged in',
    already_logged_in: 'Already logged in',
    missing_token: 'Missing token',
    logged_out: 'Logged out',
    already_created: 'User already exists',
    database_error: "Database error",
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
