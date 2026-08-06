import crypto from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { deviceInputSchema, deviceUpdateSchema } from '../validators/deviceSchema';
import { deviceRepository } from '../repositories/deviceRepository';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/prisma';
import { ValidationError } from '../utils/validation';

function generateDeviceId(): string {
  return `dev_${crypto.randomBytes(8).toString('hex')}`;
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await deviceRepository.list());
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) {
    res.status(404).json({ error: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' });
    return;
  }
  res.json(device);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = deviceInputSchema.parse(req.body);

  if (input.programId) {
    const program = await prisma.program.findUnique({ where: { id: input.programId } });
    if (!program) {
      throw new ValidationError('연결하려는 프로그램을 찾을 수 없습니다.');
    }
  }

  const device = await deviceRepository.create({
    deviceId: generateDeviceId(),
    name: input.name,
    deviceType: input.deviceType,
    programId: input.programId || null,
    location: input.location || null,
    memo: input.memo || null,
    enabled: input.enabled,
  });

  await services.auditService.log({
    action: 'DEVICE_CREATE',
    actorUsername: req.session.username,
    targetType: 'Device',
    targetId: device.id,
    result: 'SUCCESS',
  });

  res.status(201).json(device);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const existing = await deviceRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' });
    return;
  }
  const input = deviceUpdateSchema.parse(req.body);

  if (input.programId) {
    const program = await prisma.program.findUnique({ where: { id: input.programId } });
    if (!program) {
      throw new ValidationError('연결하려는 프로그램을 찾을 수 없습니다.');
    }
  }

  const updated = await deviceRepository.update(existing.id, {
    name: input.name ?? existing.name,
    deviceType: input.deviceType ?? existing.deviceType,
    programId: input.programId !== undefined ? input.programId || null : existing.programId,
    location: input.location !== undefined ? input.location || null : existing.location,
    memo: input.memo !== undefined ? input.memo || null : existing.memo,
    enabled: input.enabled ?? existing.enabled,
  });

  await services.auditService.log({
    action: 'DEVICE_UPDATE',
    actorUsername: req.session.username,
    targetType: 'Device',
    targetId: updated.id,
    result: 'SUCCESS',
  });

  res.json(updated);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const existing = await deviceRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' });
    return;
  }
  await deviceRepository.delete(existing.id);
  await services.auditService.log({
    action: 'DEVICE_DELETE',
    actorUsername: req.session.username,
    targetType: 'Device',
    targetId: existing.id,
    result: 'SUCCESS',
  });
  res.json({ ok: true });
});

export const regenerateToken = asyncHandler(async (req: Request, res: Response) => {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) {
    res.status(404).json({ error: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' });
    return;
  }

  const plainToken = generateToken();
  const tokenHash = await bcrypt.hash(plainToken, 12);

  await prisma.deviceToken.updateMany({
    where: { deviceId: device.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.deviceToken.create({ data: { deviceId: device.id, tokenHash } });

  await services.auditService.log({
    action: 'DEVICE_TOKEN_REGENERATE',
    actorUsername: req.session.username,
    targetType: 'Device',
    targetId: device.id,
    result: 'SUCCESS',
  });

  // The plaintext token is shown exactly once and is never stored or logged.
  res.json({ deviceId: device.deviceId, token: plainToken });
});
