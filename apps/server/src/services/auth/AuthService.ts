import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const BCRYPT_ROUNDS = 12;

export class AuthService {
  async createUser(username: string, password: string) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return prisma.user.create({ data: { username, passwordHash } });
  }

  async countUsers(): Promise<number> {
    return prisma.user.count();
  }

  /** Verifies credentials and applies the lockout policy. Throws AuthError on any failure. */
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      // Still hash a dummy value to keep response timing similar regardless
      // of whether the username exists.
      await bcrypt.compare(password, '$2a$12$invalidsaltinvalidsaltinvalidsaltuu');
      throw new AuthError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthError('로그인 시도 횟수 초과로 계정이 잠겨 있습니다. 잠시 후 다시 시도하세요.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.loginMaxAttempts;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + env.loginLockoutMinutes * 60_000)
            : null,
        },
      });
      throw new AuthError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    return user;
  }
}
