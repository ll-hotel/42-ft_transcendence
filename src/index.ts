import Fastify, { FastifyInstance } from 'fastify'
import fs from 'fs'
import { auth } from './auth';
import { STATUS } from './shared';

const app: FastifyInstance = Fastify({});

app.get('/', (req, res) => {
    if (req.url === '/') {
        const file: string = fs.readFileSync('www/index.html', 'utf-8');
        res.header('content-type', 'text/html');
        return file;
    }
});

app.get('/ping', (_req, res) => {
    res.code(STATUS.success).send('pong');
});

async function main() {
    try {
        auth.setup(app);
        await app.listen({ port: 8080, host: '0.0.0.0' });
    } catch (err: any) {
        console.log('Unhandled error caught in main:', err);
        process.exit(1);
    }
}

main();
