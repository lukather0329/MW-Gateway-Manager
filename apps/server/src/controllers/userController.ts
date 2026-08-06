import { Request, Response } from 'express';
import { createUserSchema } from '../validators/authSchema';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/prisma';
import { ValidationError } from '../utils/validation';

// No public sign-up route exists anywhere in the app (spec 6.1). This
// controller is only reachable by an already-authenticated admin, and is
// the mechanism for adding the (at most a handful of) additional internal
// admin accounts mentioned in spec section 11 ("사용자 관리").
export const list = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, createdAt: true, lockedUntil: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ValidationError('이미 존재하는 아이디입니다.');
  }

  const user = await services.authService.createUser(input.username, input.password);
  await services.auditService.log({
    action: 'USER_CREATE',
    actorUsername: req.session.username,
    targetType: 'User',
    targetId: user.id,
    result: 'SUCCESS',
    detail: { username: input.username },
  });
  res.status(201).json({ id: user.id, username: user.username });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.session.userId) {
    throw new ValidationError('자기 자신의 계정은 삭제할 수 없습니다.');
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await services.auditService.log({
    action: 'USER_DELETE',
    actorUsername: req.session.username,
    targetType: 'User',
    targetId: req.params.id,
    result: 'SUCCESS',
  });
  res.json({ ok: true });
});
