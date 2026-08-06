import { Request, Response } from 'express';
import path from 'node:path';
import { prisma } from '../config/prisma';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';
import { toBackupPaths } from '../utils/settingsMapper';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const backups = await prisma.apacheBackup.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(backups);
});

export const createManualBackup = asyncHandler(async (req: Request, res: Response) => {
  const settings = await services.settingsService.get();
  const result = await services.apacheBackupService.createBackup(
    toBackupPaths(settings),
    req.session.username ?? 'unknown',
    'manual'
  );

  const record = await prisma.apacheBackup.create({
    data: {
      folderName: result.folderName,
      reason: 'manual',
      createdBy: req.session.username ?? 'unknown',
      manifestJson: JSON.stringify(result.manifest),
    },
  });

  await services.auditService.log({
    action: 'BACKUP_CREATE',
    actorUsername: req.session.username,
    targetType: 'ApacheBackup',
    targetId: record.id,
    result: 'SUCCESS',
  });

  res.status(201).json(record);
});

export const restore = asyncHandler(async (req: Request, res: Response) => {
  const backup = await prisma.apacheBackup.findUnique({ where: { id: req.params.id } });
  if (!backup) {
    res.status(404).json({ error: 'NOT_FOUND', message: '백업을 찾을 수 없습니다.' });
    return;
  }

  const settings = await services.settingsService.get();
  const paths = toBackupPaths(settings);
  const folderPath = path.join(paths.backupRootPath, backup.folderName);

  await services.apacheBackupService.restoreBackup(folderPath, paths);
  const test = await services.apacheConfigValidator.test();

  let reloadCode: number | null = null;
  if (test.valid) {
    const reload = await services.apacheRunner.gracefulReload();
    reloadCode = reload.code;
  }

  await prisma.apacheBackup.update({
    where: { id: backup.id },
    data: {
      restored: true,
      restoredAt: new Date(),
      testResult: test.valid ? 'OK' : 'FAILED',
      applyResult: reloadCode === 0 ? 'OK' : reloadCode === null ? 'SKIPPED' : 'FAILED',
    },
  });

  await services.auditService.log({
    action: 'BACKUP_RESTORE',
    actorUsername: req.session.username,
    targetType: 'ApacheBackup',
    targetId: backup.id,
    result: test.valid && reloadCode === 0 ? 'SUCCESS' : 'FAILURE',
    detail: { syntaxValid: test.valid, reloadCode },
  });

  res.json({ syntaxValid: test.valid, reloadCode });
});
