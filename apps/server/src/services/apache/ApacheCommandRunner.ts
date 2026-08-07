export interface ApacheCommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface ApacheStatusResult {
  running: boolean;
  pid?: number;
  /**
   * Every httpd.exe PID currently running (parent + worker processes).
   * Used by ApacheApplyService to detect a "successful" reload that didn't
   * actually happen: on Windows, `-k restart` can return exit code 0 with
   * empty stdout/stderr even when it fails to signal the service (the
   * error is written straight to Apache's own error.log instead) — the
   * process set staying byte-for-byte identical across a reload is the
   * only reliable signal that nothing actually restarted.
   */
  pids?: number[];
}

/**
 * Abstraction over the actual `httpd.exe` process control so the rest of
 * the codebase never shells out directly. Two implementations exist:
 *  - RealApacheCommandRunner: spawns httpd.exe with execFile (args array,
 *    never string-concatenated), for use on the real Windows Server host.
 *  - MockApacheCommandRunner: used in local development and automated
 *    tests where no real Apache installation is present, so the real
 *    operating Apache is never restarted by CI or by developers running
 *    the test suite locally.
 */
export interface ApacheCommandRunner {
  testConfig(configPathOverride?: string): Promise<ApacheCommandResult>;
  gracefulReload(): Promise<ApacheCommandResult>;
  getVersion(): Promise<ApacheCommandResult>;
  getModules(): Promise<ApacheCommandResult>;
  getStatus(): Promise<ApacheStatusResult>;
}
