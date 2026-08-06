import { ApacheCommandRunner } from './ApacheCommandRunner';

export interface ConfigTestOutcome {
  valid: boolean;
  raw: string;
}

/** Thin wrapper around `httpd.exe -t` so callers deal with a boolean, not exit codes. */
export class ApacheConfigValidator {
  constructor(private readonly runner: ApacheCommandRunner) {}

  async test(): Promise<ConfigTestOutcome> {
    const result = await this.runner.testConfig();
    const combined = `${result.stdout}\n${result.stderr}`.trim();
    return { valid: result.code === 0, raw: combined };
  }
}
