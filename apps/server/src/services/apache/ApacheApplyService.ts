import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ApacheConfigGenerator,
  ApacheSettingsInput,
  ProgramConfigInput,
} from './ApacheConfigGenerator';
import { ApacheConfigValidator } from './ApacheConfigValidator';
import { ApacheBackupService, BackupPaths } from './ApacheBackupService';
import { ApacheRollbackService } from './ApacheRollbackService';
import { ApacheCommandRunner } from './ApacheCommandRunner';

export interface ApplyPaths extends BackupPaths {}

export type ApplyAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface ApplyOutcome {
  success: boolean;
  action: ApplyAction;
  fileName: string;
  content: string | null;
  syntaxTestRaw: string;
  syntaxValid: boolean | null;
  reloadCode: number | null;
  processRunning: boolean | null;
  rolledBack: boolean;
  message: string;
  backupFolderName: string;
}

/**
 * Orchestrates the full safe-apply pipeline described in the spec section
 * 6.7: backup -> write/remove candidate file -> syntax test -> reload
 * (`-k restart` on Windows — mpm_winnt has no working graceful reload, see
 * RealApacheCommandRunner.gracefulReload) -> process check -> rollback on
 * any Apache-level failure.
 *
 * Does not perform the target-program connectivity check (spec step 9) —
 * that is intentionally a separate, injectable concern (see
 * services/health-check) so an unreachable *target program* never causes
 * this service to roll back a syntactically valid Apache config, per the
 * policy in spec section 6.8.
 */
export class ApacheApplyService {
  constructor(
    private readonly generator: ApacheConfigGenerator,
    private readonly validator: ApacheConfigValidator,
    private readonly backupService: ApacheBackupService,
    private readonly rollbackService: ApacheRollbackService,
    private readonly runner: ApacheCommandRunner
  ) {}

  async applyProgramConfig(
    program: ProgramConfigInput,
    settings: ApacheSettingsInput,
    paths: ApplyPaths,
    actor: string,
    action: 'CREATE' | 'UPDATE'
  ): Promise<ApplyOutcome> {
    const generated = this.generator.generate(program, settings, paths.managedSitesPath);

    return this.applyAndVerify({
      paths,
      action,
      fileName: generated.fileName,
      content: generated.content,
      reason: `program-${action.toLowerCase()}:${program.domain}`,
      mutate: async () => {
        await fs.mkdir(paths.managedSitesPath, { recursive: true });
        await fs.writeFile(generated.filePath, generated.content, 'utf-8');
      },
    });
  }

  async removeProgramConfig(
    fileName: string,
    paths: ApplyPaths,
    domainForReason: string
  ): Promise<ApplyOutcome> {
    const filePath = path.join(paths.managedSitesPath, fileName);

    return this.applyAndVerify({
      paths,
      action: 'DELETE',
      fileName,
      content: null,
      reason: `program-remove:${domainForReason}`,
      mutate: async () => {
        await fs.rm(filePath, { force: true });
      },
    });
  }

  private async applyAndVerify(args: {
    paths: ApplyPaths;
    action: ApplyAction;
    fileName: string;
    content: string | null;
    reason: string;
    mutate: () => Promise<void>;
  }): Promise<ApplyOutcome> {
    const { paths, action, fileName, content, reason, mutate } = args;

    const backup = await this.backupService.createBackup(paths, 'system', reason);

    try {
      await mutate();
    } catch (err) {
      return {
        success: false,
        action,
        fileName,
        content,
        syntaxTestRaw: '',
        syntaxValid: null,
        reloadCode: null,
        processRunning: null,
        rolledBack: false,
        message: `설정 파일 쓰기 실패: ${err instanceof Error ? err.message : String(err)}`,
        backupFolderName: backup.folderName,
      };
    }

    const test = await this.validator.test();
    if (!test.valid) {
      const rollback = await this.rollbackService.rollbackTo(backup.folderPath, paths);
      return {
        success: false,
        action,
        fileName,
        content,
        syntaxTestRaw: test.raw,
        syntaxValid: false,
        reloadCode: null,
        processRunning: null,
        rolledBack: rollback.restored,
        message: `Apache 문법 검사 실패로 이전 설정으로 복구${
          rollback.restored ? '했습니다' : '를 시도했으나 실패했습니다'
        }.`,
        backupFolderName: backup.folderName,
      };
    }

    const reload = await this.runner.gracefulReload();
    if (reload.code !== 0) {
      const rollback = await this.rollbackService.rollbackTo(backup.folderPath, paths);
      return {
        success: false,
        action,
        fileName,
        content,
        syntaxTestRaw: test.raw,
        syntaxValid: true,
        reloadCode: reload.code,
        processRunning: null,
        rolledBack: rollback.restored,
        message: `Apache 설정 재적용(reload) 실패로 이전 설정으로 복구${
          rollback.restored ? '했습니다' : '를 시도했으나 실패했습니다'
        }.`,
        backupFolderName: backup.folderName,
      };
    }

    const status = await this.runner.getStatus();
    if (!status.running) {
      const rollback = await this.rollbackService.rollbackTo(backup.folderPath, paths);
      return {
        success: false,
        action,
        fileName,
        content,
        syntaxTestRaw: test.raw,
        syntaxValid: true,
        reloadCode: reload.code,
        processRunning: false,
        rolledBack: rollback.restored,
        message: `Apache 프로세스가 확인되지 않아 이전 설정으로 복구${
          rollback.restored ? '했습니다' : '를 시도했으나 실패했습니다'
        }.`,
        backupFolderName: backup.folderName,
      };
    }

    return {
      success: true,
      action,
      fileName,
      content,
      syntaxTestRaw: test.raw,
      syntaxValid: true,
      reloadCode: reload.code,
      processRunning: true,
      rolledBack: false,
      message: '설정이 정상적으로 적용되었습니다.',
      backupFolderName: backup.folderName,
    };
  }
}
