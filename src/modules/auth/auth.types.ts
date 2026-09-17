import { z } from 'zod';

export type UserRole = 'PartnerAssistant' | 'CreditExpert' | 'Admin' | 'Customer';

export interface JwtUserPayload {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  franchiseId: string;
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export type LoginInput = z.infer<typeof loginSchema>;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}
