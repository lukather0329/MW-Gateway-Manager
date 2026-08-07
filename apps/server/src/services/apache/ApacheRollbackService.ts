import { ApacheBackupService, BackupPaths } from './ApacheBackupService';
import { ApacheCommandRunner } from './ApacheCommandRunner';
import { ApacheConfigValidator } from './ApacheConfigValidator';

export type FailureReason =
  | 'SYNTAX_ERROR'
  | 'FILE_WRITE_FAILED'
  | 'GRACEFUL_RELOAD_FAILED'
  | 'PROCESS_NOT_RUNNING'
  | 'TARGET_CONNECTIVITY_FAILED';

/**
 * Pure policy decision, kept separate from the I/O so it is trivially unit
 * testable. Matches spec section 6.8:
 *   Apache syntax / process problems -> auto rollback.
 *   Target program unreachable       -> keep config, warn only.
 */
export function shouldAutoRollback(reason: FailureReason): boolean {
  switch (reason) {
    case 'SYNTAX_ERROR':
    case 'FILE_WRITE_FAILED':
    case 'GRACEFUL_RELOAD_FAILED':
    case 'PROCESS_NOT_RUNNING':
      return true;
    case 'TARGET_CONNECTIVITY_FAILED':
      return false;
    default:
      return true;
  }
}

export interface RollbackOutcome {
  attempted: boolean;
  restored: boolean;
  postRestoreSyntaxValid?: boolean;
  postRestoreReloadCode?: number | null;
  error?: string;
}

export class ApacheRollbackService {
  constructor(
    private readonly backupService: ApacheBackupService,
    private readonly validator: ApacheConfigValidator,
    private readonly runner: ApacheCommandRunner
  ) {}

  /** Restores the given backup folder and attempts to bring Apache back to a healthy state. */
  async rollbackTo(backupFolderPath: string, paths: BackupPaths): Promise<RollbackOutcome> {
    try {
      await this.backupService.restoreBackup(backupFolderPath, paths);
    } catch (err) {
      return {
        attempted: true,
        restored: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const postRestoreTest = await this.validator.test();
    if (!postRestoreTest.valid) {
      return {
        attempted: true,
        restored: true,
        postRestoreSyntaxValid: false,
        error: '이전 설정으로 복구했지만 문법 검사에 실패했습니다. 수동 확인이 필요합니다.',
      };
    }

    const reload = await this.runner.gracefulReload();
    return {
      attempted: true,
      restored: true,
      postRestoreSyntaxValid: true,
      postRestoreReloadCode: reload.code,
      error: reload.code !== 0 ? reload.stderr || '설정 재적용(reload) 실패' : undefined,
    };
  }
}
