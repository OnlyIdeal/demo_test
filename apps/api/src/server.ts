import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './lib/auth.js';
import { errorHandler, ok } from './lib/http.js';
import { registerRoutes } from './routes/index.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',').map(value => value.trim()) ?? true });
await app.register(authPlugin);
app.setErrorHandler((error, _request, reply) => errorHandler(error, reply));
app.get('/health', async (_request, reply) => ok(reply, { status: 'ok', service: 'ai-ems-api' }));
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
await app.listen({ port, host });
