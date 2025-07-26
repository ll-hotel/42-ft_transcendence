import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { Server, IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'

const app: FastifyInstance = Fastify({});

const opts: RouteShorthandOptions = {
	schema: {
		response: {
			200: {
				type: 'object',
				properties: {
					pong: {
						type: 'string'
					}
				}
			}
		}
	}
}

app.get('/ping', opts, async (request, reply) => {
	return { pong: 'it worked!' }
});

async function main() {
	try {
		await app.listen({ port: 8080, host: '0.0.0.0' });

		const address = app.server.address()
		const port = typeof address === 'string' ? address : address?.port

		console.log(address);
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
}

main();
