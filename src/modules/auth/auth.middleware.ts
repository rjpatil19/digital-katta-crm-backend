import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, JwtUserPayload } from './auth.types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<JwtUserPayload>();
    request.user = payload;
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid, expired, or missing JWT authorization token'
    });
  }
}

export function requireRoles(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtUserPayload | undefined;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${user.role}`
      });
    }
  };
}
