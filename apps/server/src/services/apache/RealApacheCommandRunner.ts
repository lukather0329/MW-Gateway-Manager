import { execFile } from 'node:child_process';
import {
  ApacheCommandResult,
  ApacheCommandRunner,
  ApacheStatusResult,
} from './ApacheCommandRunner';

function runExecFile(
  file: string,
  args: string[],
  timeoutMs = 15000
): Promise<ApacheCommandResult> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
        stdout: stdout?.toString() ?? '',
        stderr: stderr?.toString() ?? (error ? String(error.message) : ''),
      });
    });
  });
}

/**
 * Executes the real httpd.exe binary on the Windows Server host.
 * Every call uses execFile with the executable and its arguments kept as
 * separate array entries — user input is never concatenated into a shell
 * command string.
 */
export class RealApacheCommandRunner implements ApacheCommandRunner {
  constructor(private readonly httpdExecutablePath: string) {}

  testConfig(): Promise<ApacheCommandResult> {
    return runExecFile(this.httpdExecutablePath, ['-t']);
  }

  gracefulReload(): Promise<ApacheCommandResult> {
    return runExecFile(this.httpdExecutablePath, ['-k', 'graceful']);
  }

  getVersion(): Promise<ApacheCommandResult> {
    return runExecFile(this.httpdExecutablePath, ['-v']);
  }

  getModules(): Promise<ApacheCommandResult> {
    return runExecFile(this.httpdExecutablePath, ['-M']);
  }

  async getStatus(): Promise<ApacheStatusResult> {
    const result = await runExecFile('tasklist', [
      '/FI',
      'IMAGENAME eq httpd.exe',
      '/FO',
      'CSV',
      '/NH',
    ]);
    const lines = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.toLowerCase().includes('httpd.exe'));

    if (lines.length === 0) {
      return { running: false };
    }

    const firstLine = lines[0].replace(/"/g, '');
    const pidText = firstLine.split(',')[1];
    const pid = pidText ? Number(pidText) : undefined;
    return { running: true, pid: Number.isFinite(pid) ? pid : undefined };
  }
}
