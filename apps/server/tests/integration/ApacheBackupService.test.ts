import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApacheBackupService, BackupPaths } from '../../src/services/apache/ApacheBackupService';

describe('ApacheBackupService (real filesystem, temp directory)', () => {
  let root: string;
  let paths: BackupPaths;
  const service = new ApacheBackupService();

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'mw-backup-test-'));
    paths = {
      backupRootPath: path.join(root, 'mw-backups'),
      vhostsFilePath: path.join(root, 'httpd-vhosts.conf'),
      managedSitesPath: path.join(root, 'mw-sites'),
    };
    await fs.writeFile(paths.vhostsFilePath, '# vhosts file\n', 'utf-8');
    await fs.mkdir(paths.managedSitesPath, { recursive: true });
    await fs.writeFile(path.join(paths.managedSitesPath, 'a.roboworks.co.kr.conf'), 'A', 'utf-8');
    await fs.writeFile(path.join(paths.managedSitesPath, 'b.roboworks.co.kr.conf'), 'B', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('snapshots the vhosts file and every managed site conf into a timestamped folder with a manifest', async () => {
    const result = await service.createBackup(paths, 'tester', 'unit-test');

    const backedUpVhosts = await fs.readFile(path.join(result.folderPath, 'httpd-vhosts.conf'), 'utf-8');
    expect(backedUpVhosts).toBe('# vhosts file\n');

    const backedUpA = await fs.readFile(path.join(result.folderPath, 'mw-sites', 'a.roboworks.co.kr.conf'), 'utf-8');
    expect(backedUpA).toBe('A');

    expect(result.manifest.managedSiteFiles.sort()).toEqual(['a.roboworks.co.kr.conf', 'b.roboworks.co.kr.conf']);
    expect(result.manifest.createdBy).toBe('tester');
    expect(result.manifest.reason).toBe('unit-test');
  });

  it('restoreBackup puts the live paths back exactly as they were, including removing files added afterward', async () => {
    const backup = await service.createBackup(paths, 'tester', 'before-change');

    // Simulate a change: overwrite one file, delete another, add a new one.
    await fs.writeFile(path.join(paths.managedSitesPath, 'a.roboworks.co.kr.conf'), 'CHANGED', 'utf-8');
    await fs.rm(path.join(paths.managedSitesPath, 'b.roboworks.co.kr.conf'));
    await fs.writeFile(path.join(paths.managedSitesPath, 'c.roboworks.co.kr.conf'), 'NEW', 'utf-8');
    await fs.writeFile(paths.vhostsFilePath, '# changed vhosts\n', 'utf-8');

    await service.restoreBackup(backup.folderPath, paths);

    const restoredA = await fs.readFile(path.join(paths.managedSitesPath, 'a.roboworks.co.kr.conf'), 'utf-8');
    const restoredB = await fs.readFile(path.join(paths.managedSitesPath, 'b.roboworks.co.kr.conf'), 'utf-8');
    const restoredVhosts = await fs.readFile(paths.vhostsFilePath, 'utf-8');
    expect(restoredA).toBe('A');
    expect(restoredB).toBe('B');
    expect(restoredVhosts).toBe('# vhosts file\n');

    await expect(fs.access(path.join(paths.managedSitesPath, 'c.roboworks.co.kr.conf'))).rejects.toThrow();
  });

  it('produces distinct timestamped folder names for consecutive backups within the same second', async () => {
    // Folder names include millisecond resolution specifically so that
    // two backups in quick succession (e.g. apply immediately followed by
    // delete) never collide on ApacheBackup's unique folderName column.
    const first = await service.createBackup(paths, 'tester', 'first');
    const second = await service.createBackup(paths, 'tester', 'second');
    expect(first.folderName).not.toBe(second.folderName);
  });
});
