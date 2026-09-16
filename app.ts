import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { leadsRoutes } from './modules/leads/leads.routes';
import { paymentRoutes } from './modules/payments/payment.routes';

export function buildFastifyApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  // Health check endpoint
  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'Digital कट्टा CRM Fastify Backend',
    timestamp: new Date().toISOString(),
    rbiCompliance: 'CICRA 2005 & Master Direction 2023'
  }));

  // API v1 namespaces
  app.register(
    async (v1) => {
      v1.register(authRoutes);
      v1.register(leadsRoutes);
      v1.register(paymentRoutes);
    },
    { prefix: '/api/v1' }
  );

  return app;
}