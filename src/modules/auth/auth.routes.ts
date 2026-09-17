import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/login', AuthController.login);

  fastify.get(
    '/auth/me',
    {
      preHandler: [authenticate]
    },
    AuthController.getMe
  );
}
