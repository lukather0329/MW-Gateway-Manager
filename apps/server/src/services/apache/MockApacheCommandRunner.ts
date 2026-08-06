import {
  ApacheCommandResult,
  ApacheCommandRunner,
  ApacheStatusResult,
} from './ApacheCommandRunner';

export interface MockApacheCommandRunnerOptions {
  testConfigResult?: ApacheCommandResult;
  gracefulReloadResult?: ApacheCommandResult;
  versionResult?: ApacheCommandResult;
  modulesResult?: ApacheCommandResult;
  statusResult?: ApacheStatusResult;
}

const OK: ApacheCommandResult = { code: 0, stdout: 'Syntax OK', stderr: '' };

/**
 * Used whenever no real Apache installation is available (local
 * development machines, CI, automated tests). Never touches a real
 * process. Behavior is fully configurable so tests can simulate syntax
 * errors, failed reloads, etc.
 */
export class MockApacheCommandRunner implements ApacheCommandRunner {
  constructor(private readonly options: MockApacheCommandRunnerOptions = {}) {}

  async testConfig(): Promise<ApacheCommandResult> {
    return (
      this.options.testConfigResult ?? {
        ...OK,
        stdout: 'Syntax OK (mock: real Apache not available in this environment)',
      }
    );
  }

  async gracefulReload(): Promise<ApacheCommandResult> {
    return (
      this.options.gracefulReloadResult ?? {
        code: 0,
        stdout: 'mock: graceful reload not actually executed',
        stderr: '',
      }
    );
  }

  async getVersion(): Promise<ApacheCommandResult> {
    return (
      this.options.versionResult ?? {
        code: 0,
        stdout: 'Server version: Apache/2.4 (mock)',
        stderr: '',
      }
    );
  }

  async getModules(): Promise<ApacheCommandResult> {
    return (
      this.options.modulesResult ?? {
        code: 0,
        stdout: [
          'proxy_module (shared)',
          'proxy_http_module (shared)',
          'proxy_wstunnel_module (shared)',
          'rewrite_module (shared)',
          'ssl_module (shared)',
        ].join('\n'),
        stderr: '',
      }
    );
  }

  async getStatus(): Promise<ApacheStatusResult> {
    return this.options.statusResult ?? { running: false };
  }
}
