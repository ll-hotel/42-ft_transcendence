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

app.get('/', async (request, reply) => {
	const file: string = fs.readFileSync('www/index.html', 'utf-8');
	reply.header('Content-Type', 'text/html');
	return file;
});

app.get('/ping', opts, async (request, reply) => {
	return { pong: 'it worked!' }
});

async function main() {
	try {
		await app.listen({ port: 8080, host: '0.0.0.0' });

		const address = app.server.address()
		console.log(address);
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
}

main();
