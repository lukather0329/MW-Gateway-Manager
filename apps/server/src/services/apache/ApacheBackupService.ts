import fs from 'node:fs/promises';
import path from 'node:path';

export interface BackupPaths {
  backupRootPath: string;
  vhostsFilePath: string;
  managedSitesPath: string;
}

export interface BackupManifest {
  createdAt: string;
  createdBy: string;
  reason: string;
  vhostsFileIncluded: boolean;
  managedSiteFiles: string[];
}

export interface BackupResult {
  folderName: string;
  folderPath: string;
  manifest: BackupManifest;
}

function timestampFolderName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Snapshots the current httpd-vhosts.conf and the whole mw-sites folder
 * into a timestamped directory before any real change is written. Never
 * touches the live config — read-only against it.
 */
export class ApacheBackupService {
  async createBackup(
    paths: BackupPaths,
    createdBy: string,
    reason: string
  ): Promise<BackupResult> {
    const folderName = timestampFolderName(new Date());
    const folderPath = path.join(paths.backupRootPath, folderName);
    await fs.mkdir(folderPath, { recursive: true });

    const vhostsFileIncluded = await pathExists(paths.vhostsFilePath);
    if (vhostsFileIncluded) {
      await fs.copyFile(paths.vhostsFilePath, path.join(folderPath, 'httpd-vhosts.conf'));
    }

    const managedSitesBackupDir = path.join(folderPath, 'mw-sites');
    await fs.mkdir(managedSitesBackupDir, { recursive: true });

    let managedSiteFiles: string[] = [];
    if (await pathExists(paths.managedSitesPath)) {
      const entries = await fs.readdir(paths.managedSitesPath, { withFileTypes: true });
      const confFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.conf'));
      for (const entry of confFiles) {
        await fs.copyFile(
          path.join(paths.managedSitesPath, entry.name),
          path.join(managedSitesBackupDir, entry.name)
        );
      }
      managedSiteFiles = confFiles.map((e) => e.name);
    }

    const manifest: BackupManifest = {
      createdAt: new Date().toISOString(),
      createdBy,
      reason,
      vhostsFileIncluded,
      managedSiteFiles,
    };
    await fs.writeFile(
      path.join(folderPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return { folderName, folderPath, manifest };
  }

  /** Reads back the manifest for a backup folder created by createBackup(). */
  async readManifest(backupRootPath: string, folderName: string): Promise<BackupManifest> {
    const raw = await fs.readFile(
      path.join(backupRootPath, folderName, 'manifest.json'),
      'utf-8'
    );
    return JSON.parse(raw);
  }

  /** Restores a previous backup folder back onto the live config paths. */
  async restoreBackup(folderPath: string, paths: BackupPaths): Promise<void> {
    const manifestRaw = await fs.readFile(path.join(folderPath, 'manifest.json'), 'utf-8');
    const manifest: BackupManifest = JSON.parse(manifestRaw);

    if (manifest.vhostsFileIncluded) {
      await fs.copyFile(
        path.join(folderPath, 'httpd-vhosts.conf'),
        paths.vhostsFilePath
      );
    }

    await fs.mkdir(paths.managedSitesPath, { recursive: true });
    const currentEntries = await fs
      .readdir(paths.managedSitesPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of currentEntries) {
      if (entry.isFile() && entry.name.endsWith('.conf')) {
        await fs.rm(path.join(paths.managedSitesPath, entry.name));
      }
    }
    for (const fileName of manifest.managedSiteFiles) {
      await fs.copyFile(
        path.join(folderPath, 'mw-sites', fileName),
        path.join(paths.managedSitesPath, fileName)
      );
    }
  }
}
