import { prisma } from '../../config/prisma';

export type AuditResult = 'SUCCESS' | 'FAILURE';

export interface AuditEntryInput {
  action: string;
  actorUsername?: string | null;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  result: AuditResult;
}

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'token', 'tokenHash', 'secret']);

function redact(detail: Record<string, unknown> | undefined): string | null {
  if (!detail) return null;
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    clone[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value;
  }
  return JSON.stringify(clone);
}

/** Every write goes through here so audit coverage cannot be forgotten in a controller. */
export class AuditService {
  async log(entry: AuditEntryInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorUsername: entry.actorUsername ?? null,
        targetType: entry.targetType,
        targetId: entry.targetId,
        detail: redact(entry.detail),
        result: entry.result,
      },
    });
  }

  async list(limit = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
