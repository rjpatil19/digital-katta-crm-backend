import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { loginSchema, JwtUserPayload } from './auth.types';

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        details: parseResult.error.issues
      });
    }

    try {
      const userPayload = await AuthService.authenticateUser(parseResult.data);
      if (!userPayload) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid Credentials',
          message: 'Incorrect email or password'
        });
      }

      // Generate JWT
      const token = request.server.jwt.sign(userPayload, {
        expiresIn: '7d'
      });

      return reply.status(200).send({
        success: true,
        message: 'Authentication successful',
        data: {
          token,
          user: userPayload
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'Authentication Error',
        message: err.message
      });
    }
  }

  static async getMe(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtUserPayload;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'No user session found'
      });
    }

    const profile = await AuthService.getUserById(user.id);
    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: 'Not Found',
        message: 'User account not found'
      });
    }

    return reply.status(200).send({
      success: true,
      data: profile
    });
  }
}
