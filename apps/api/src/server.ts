import cors from '@fastify/cors';
import Fastify from 'fastify';
import { env } from './env.js';
import { prisma } from './db.js';
import { registerRoutes } from './routes.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await registerRoutes(app);

const shutdown = async () => { await app.close(); await prisma.$disconnect(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
