import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApacheApplyService, ApplyPaths } from '../../src/services/apache/ApacheApplyService';
import { ApacheBackupService } from '../../src/services/apache/ApacheBackupService';
import { ApacheConfigGenerator } from '../../src/services/apache/ApacheConfigGenerator';
import { ApacheConfigValidator } from '../../src/services/apache/ApacheConfigValidator';
import { ApacheRollbackService } from '../../src/services/apache/ApacheRollbackService';
import { MockApacheCommandRunner } from '../../src/services/apache/MockApacheCommandRunner';

const program = {
  domain: 'camera.roboworks.co.kr',
  targetProtocol: 'http' as const,
  targetHost: '127.0.0.1',
  targetPort: 3101,
  websocketEnabled: false,
  sslEnabled: false,
};
const settings = {
  sslCertificatePath: 'D:\\certs\\crt.pem',
  sslCertificateKeyPath: 'D:\\certs\\key.pem',
};

function buildService(runner: MockApacheCommandRunner) {
  const backupService = new ApacheBackupService();
  const validator = new ApacheConfigValidator(runner);
  const rollback = new ApacheRollbackService(backupService, validator, runner);
  return new ApacheApplyService(new ApacheConfigGenerator(), validator, backupService, rollback, runner);
}

describe('ApacheApplyService (real filesystem via temp dir, mocked httpd.exe)', () => {
  let root: string;
  let paths: ApplyPaths;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'mw-apply-test-'));
    paths = {
      backupRootPath: path.join(root, 'mw-backups'),
      vhostsFilePath: path.join(root, 'httpd-vhosts.conf'),
      managedSitesPath: path.join(root, 'mw-sites'),
    };
    await fs.writeFile(paths.vhostsFilePath, '# vhosts\n', 'utf-8');
    await fs.mkdir(paths.managedSitesPath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes the file and reports success when syntax check, reload, and process check all pass', async () => {
    const runner = new MockApacheCommandRunner({ statusResult: { running: true, pid: 123 } });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(true);
    expect(outcome.rolledBack).toBe(false);
    expect(outcome.syntaxValid).toBe(true);

    const written = await fs.readFile(
      path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'),
      'utf-8'
    );
    expect(written).toContain('ServerName camera.roboworks.co.kr');
  });

  it('rolls back when reload reports success (exit 0) but the httpd.exe process set never changed', async () => {
    // Reproduces a real bug found by testing against a real, permission-
    // restricted XAMPP install: `-k restart` returned exit 0 with no
    // stderr while completely failing to signal the Windows service (the
    // error only showed up in Apache's own error.log). The same PID set
    // before and after is the only signal that nothing actually reloaded.
    const runner = new MockApacheCommandRunner({
      statusResult: { running: true, pid: 900, pids: [900, 13328] },
    });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(false);
    expect(outcome.reloadCode).toBe(0);
    expect(outcome.processRunning).toBe(true);
    expect(outcome.rolledBack).toBe(true);
    expect(outcome.message).toContain('실제로 재시작되지 않아');
    await expect(
      fs.access(path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'))
    ).rejects.toThrow();
  });

  it('does NOT roll back when the runner cannot report pids (older/unknown status source)', async () => {
    // Guards against the new same-PID-set check ever becoming a false
    // positive for a runner that simply doesn't populate `pids`.
    const runner = new MockApacheCommandRunner({ statusResult: { running: true, pid: 123 } });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(true);
    expect(outcome.rolledBack).toBe(false);
  });

  it('rolls back and leaves mw-sites untouched when the syntax check fails', async () => {
    const runner = new MockApacheCommandRunner({
      testConfigResult: { code: 1, stdout: '', stderr: 'Syntax error on line 3' },
      statusResult: { running: true, pid: 123 },
    });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(false);
    expect(outcome.syntaxValid).toBe(false);
    expect(outcome.rolledBack).toBe(true);

    // File must not remain on disk: it didn't exist before this apply, so
    // rollback (restoring the pre-apply backup) must remove it again.
    await expect(
      fs.access(path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'))
    ).rejects.toThrow();
  });

  it('rolls back when graceful reload fails, even though syntax was valid', async () => {
    const runner = new MockApacheCommandRunner({
      gracefulReloadResult: { code: 1, stdout: '', stderr: 'reload failed' },
      statusResult: { running: true, pid: 123 },
    });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(false);
    expect(outcome.syntaxValid).toBe(true);
    expect(outcome.rolledBack).toBe(true);
    await expect(
      fs.access(path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'))
    ).rejects.toThrow();
  });

  it('rolls back when the Apache process is not running after reload', async () => {
    const runner = new MockApacheCommandRunner({ statusResult: { running: false } });
    const service = buildService(runner);

    const outcome = await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    expect(outcome.success).toBe(false);
    expect(outcome.processRunning).toBe(false);
    expect(outcome.rolledBack).toBe(true);
  });

  it('restores the previous version of a file on a failed UPDATE, not just deletes it', async () => {
    const workingRunner = new MockApacheCommandRunner({ statusResult: { running: true, pid: 1 } });
    const workingService = buildService(workingRunner);
    await workingService.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    const previousContent = await fs.readFile(
      path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'),
      'utf-8'
    );

    const failingRunner = new MockApacheCommandRunner({
      testConfigResult: { code: 1, stdout: '', stderr: 'bad syntax' },
      statusResult: { running: true, pid: 1 },
    });
    const failingService = buildService(failingRunner);
    const updatedProgram = { ...program, targetPort: 9999 };
    const outcome = await failingService.applyProgramConfig(updatedProgram, settings, paths, 'tester', 'UPDATE');

    expect(outcome.success).toBe(false);
    expect(outcome.rolledBack).toBe(true);

    const restoredContent = await fs.readFile(
      path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'),
      'utf-8'
    );
    expect(restoredContent).toBe(previousContent);
    expect(restoredContent).toContain(':3101');
    expect(restoredContent).not.toContain(':9999');
  });

  it('removeProgramConfig deletes the file on success', async () => {
    const runner = new MockApacheCommandRunner({ statusResult: { running: true, pid: 1 } });
    const service = buildService(runner);
    await service.applyProgramConfig(program, settings, paths, 'tester', 'CREATE');

    const outcome = await service.removeProgramConfig(
      'camera.roboworks.co.kr.conf',
      paths,
      program.domain
    );

    expect(outcome.success).toBe(true);
    await expect(
      fs.access(path.join(paths.managedSitesPath, 'camera.roboworks.co.kr.conf'))
    ).rejects.toThrow();
  });
});
