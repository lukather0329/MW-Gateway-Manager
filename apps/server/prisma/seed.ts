/**
 * One-time initial admin account creation.
 * Usage:
 *   npm run seed --workspace=apps/server -- --username admin --password "A-Strong-Passphrase-2026"
 * or set ADMIN_USERNAME / ADMIN_PASSWORD in the environment before running.
 *
 * Refuses to run with an obviously weak/default password (spec 6.1: "기본
 * 비밀번호 강제 사용 금지"). This script is meant to be run once per
 * deployment, not as a general user-management tool (see /api/users for
 * that, which requires an existing authenticated admin).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const WEAK_PASSWORDS = new Set([
  'password',
  'admin',
  'admin123',
  '12345678',
  '123456789',
  'password123',
  'qwerty123',
  'changeme',
]);

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((a) => a.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const username = parseArg('username') ?? process.env.ADMIN_USERNAME;
  const password = parseArg('password') ?? process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      '사용법: --username <아이디> --password <비밀번호> 인자 또는 ADMIN_USERNAME/ADMIN_PASSWORD 환경변수를 지정하세요.'
    );
    process.exit(1);
  }

  if (username.length < 3) {
    console.error('아이디는 3자 이상이어야 합니다.');
    process.exit(1);
  }

  if (password.length < 10 || WEAK_PASSWORDS.has(password.toLowerCase())) {
    console.error('비밀번호가 너무 짧거나 흔히 쓰이는 취약한 값입니다. 최소 10자 이상의 고유한 비밀번호를 사용하세요.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.error(`이미 존재하는 아이디입니다: ${username}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { username, passwordHash } });
    console.log(`초기 관리자 계정이 생성되었습니다: ${user.username} (id: ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
