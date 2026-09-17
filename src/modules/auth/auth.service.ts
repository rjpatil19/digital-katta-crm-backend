import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../db/schema';
import { LoginInput, JwtUserPayload, UserRole } from './auth.types';

export class AuthService {
  /**
   * Authenticates user with email and password
   */
  static async authenticateUser(input: LoginInput): Promise<JwtUserPayload | null> {
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase().trim()))
      .limit(1);

    if (userList.length === 0) {
      return null;
    }

    const user = userList[0];

    if (!user.isActive) {
      throw new Error('User account is deactivated. Contact branch administrator.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      franchiseId: user.franchiseId
    };
  }

  /**
   * Fetches user profile by ID
   */
  static async getUserById(userId: string) {
    const userList = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        franchiseId: users.franchiseId,
        isActive: users.isActive,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userList.length > 0 ? userList[0] : null;
  }
}
