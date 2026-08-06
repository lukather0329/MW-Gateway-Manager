export interface ApacheCommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface ApacheStatusResult {
  running: boolean;
  pid?: number;
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
