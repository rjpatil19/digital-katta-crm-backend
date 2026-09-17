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

  // Register CORS
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Register JWT
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  // Health Check
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'Digital कट्टा CRM Fastify Backend',
      timestamp: new Date().toISOString(),
      rbiCompliance: 'CICRA 2005 & Master Direction 2023'
    };
  });

  // Register API v1 Routes
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
