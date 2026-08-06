import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  const [total, active, healthy, errored, lastConfigChange, recentHealthErrors, recentBackups, processStatus, syntaxTest] =
    await Promise.all([
      prisma.program.count(),
      prisma.program.count({ where: { enabled: true } }),
      prisma.program.count({ where: { healthStatus: { in: ['HEALTHY', 'HTTP_OK'] } } }),
      prisma.program.count({ where: { healthStatus: { in: ['UNREACHABLE', 'HEALTH_CHECK_FAILED'] } } }),
      prisma.apacheConfigRevision.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.programHealthCheck.findMany({
        where: { status: { in: ['UNREACHABLE', 'HEALTH_CHECK_FAILED'] } },
        orderBy: { checkedAt: 'desc' },
        take: 5,
        include: { program: { select: { name: true, domain: true } } },
      }),
      prisma.apacheBackup.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      services.apacheRunner.getStatus(),
      services.apacheConfigValidator.test(),
    ]);

  res.json({
    programCounts: { total, active, healthy, errored },
    apache: { processStatus, lastSyntaxCheck: syntaxTest },
    lastConfigChange,
    recentHealthErrors,
    recentBackups,
  });
});
