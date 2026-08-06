import fs from 'node:fs/promises';
import path from 'node:path';
import { ApacheCommandRunner } from './ApacheCommandRunner';
import { ApacheModuleInspector } from './ApacheModuleInspector';

export interface SetupCheckPaths {
  apacheRootPath: string;
  apacheExecutablePath: string;
  apacheVhostsPath: string;
  managedSitesPath: string;
  backupPath: string;
  sslCertificatePath: string;
  sslCertificateKeyPath: string;
}

export interface SetupCheckResult {
  apacheRootPathExists: boolean;
  httpdExecutableExists: boolean;
  vhostsFileExists: boolean;
  managedSitesPathWritable: boolean;
  backupPathWritable: boolean;
  apacheVersion: string | null;
  moduleCheck: Awaited<ReturnType<ApacheModuleInspector['check']>> | null;
  sslCertificateExists: boolean;
  sslCertificateKeyExists: boolean;
  currentSyntaxValid: boolean | null;
  currentSyntaxRaw: string | null;
  includeOptionalLinePresent: boolean;
  includeOptionalLine: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function canCreateDir(p: string): Promise<boolean> {
  try {
    await fs.mkdir(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function buildIncludeOptionalLine(managedSitesPath: string): string {
  const forwardSlashPath = managedSitesPath.replace(/\\/g, '/');
  const glob = forwardSlashPath.endsWith('/')
    ? `${forwardSlashPath}*.conf`
    : `${forwardSlashPath}/*.conf`;
  return `IncludeOptional "${glob}"`;
}

/**
 * Read-only inspection used by the first-run setup wizard (spec section
 * 12). Never mutates httpd-vhosts.conf on its own — `applyIncludeOptional`
 * is a separate, explicit action the admin must trigger after reviewing
 * these results.
 */
export class ApacheSetupWizardService {
  constructor(private readonly runner: ApacheCommandRunner) {}

  async check(paths: SetupCheckPaths): Promise<SetupCheckResult> {
    const apacheRootPathExists = await exists(paths.apacheRootPath);
    const httpdExecutableExists = await exists(paths.apacheExecutablePath);
    const vhostsFileExists = await exists(paths.apacheVhostsPath);
    const managedSitesPathWritable = await canCreateDir(paths.managedSitesPath);
    const backupPathWritable = await canCreateDir(paths.backupPath);
    const sslCertificateExists = await exists(paths.sslCertificatePath);
    const sslCertificateKeyExists = await exists(paths.sslCertificateKeyPath);

    let apacheVersion: string | null = null;
    let moduleCheck: SetupCheckResult['moduleCheck'] = null;
    let currentSyntaxValid: boolean | null = null;
    let currentSyntaxRaw: string | null = null;

    if (httpdExecutableExists) {
      const version = await this.runner.getVersion();
      apacheVersion = version.stdout || version.stderr || null;
      moduleCheck = await new ApacheModuleInspector(this.runner).check();
      const test = await this.runner.testConfig();
      currentSyntaxValid = test.code === 0;
      currentSyntaxRaw = `${test.stdout}\n${test.stderr}`.trim();
    }

    const includeOptionalLine = buildIncludeOptionalLine(paths.managedSitesPath);
    let includeOptionalLinePresent = false;
    if (vhostsFileExists) {
      const content = await fs.readFile(paths.apacheVhostsPath, 'utf-8');
      includeOptionalLinePresent = content.includes('mw-sites');
    }

    return {
      apacheRootPathExists,
      httpdExecutableExists,
      vhostsFileExists,
      managedSitesPathWritable,
      backupPathWritable,
      apacheVersion,
      moduleCheck,
      sslCertificateExists,
      sslCertificateKeyExists,
      currentSyntaxValid,
      currentSyntaxRaw,
      includeOptionalLinePresent,
      includeOptionalLine,
    };
  }

  /**
   * Appends the IncludeOptional line to httpd-vhosts.conf exactly once.
   * Must only be called after the admin has reviewed `check()` results and
   * explicitly confirmed. Does not remove or otherwise alter any existing
   * content in the file.
   */
  async applyIncludeOptional(paths: SetupCheckPaths): Promise<{ applied: boolean; alreadyPresent: boolean }> {
    const content = await fs.readFile(paths.apacheVhostsPath, 'utf-8');
    if (content.includes('mw-sites')) {
      return { applied: false, alreadyPresent: true };
    }

    const line = buildIncludeOptionalLine(paths.managedSitesPath);
    const separator = content.endsWith('\n') ? '' : '\n';
    await fs.writeFile(
      paths.apacheVhostsPath,
      `${content}${separator}\n# Added by MW Gateway Manager\n${line}\n`,
      'utf-8'
    );
    return { applied: true, alreadyPresent: false };
  }
}
