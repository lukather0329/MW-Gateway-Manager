import { prisma } from '../config/prisma';
import { services } from '../services/container';
import type { ApplyOutcome } from '../services/apache/ApacheApplyService';

/**
 * Every apply/remove pipeline run creates a backup folder on disk (see
 * ApacheApplyService.applyAndVerify). This mirrors that folder into the
 * ApacheBackup table so it shows up in the Backups screen and dashboard
 * the same way a manual backup does (spec 6.9) — otherwise automatic
 * pre-apply backups would be invisible in the UI despite existing on disk.
 */
export async function recordApplyBackup(
  backupRootPath: string,
  outcome: ApplyOutcome,
  actorUsername: string | undefined,
  reason: string
): Promise<void> {
  const manifest = await services.apacheBackupService.readManifest(
    backupRootPath,
    outcome.backupFolderName
  );
  await prisma.apacheBackup.create({
    data: {
      folderName: outcome.backupFolderName,
      reason,
      createdBy: actorUsername ?? 'unknown',
      manifestJson: JSON.stringify(manifest),
      testResult: outcome.syntaxValid === null ? null : outcome.syntaxValid ? 'OK' : 'FAILED',
      applyResult: outcome.success ? 'OK' : outcome.rolledBack ? 'ROLLED_BACK' : 'FAILED',
      restored: outcome.rolledBack,
      restoredAt: outcome.rolledBack ? new Date() : null,
    },
  });
}
