import { ApacheCommandRunner } from './ApacheCommandRunner';

export const REQUIRED_MODULES = [
  'proxy_module',
  'proxy_http_module',
  'rewrite_module',
  'ssl_module',
] as const;

export const WEBSOCKET_MODULE = 'proxy_wstunnel_module';

export interface ModuleCheckResult {
  raw: string;
  loadedModules: string[];
  missingRequired: string[];
  websocketSupported: boolean;
}

/**
 * Never assumes which Apache modules are enabled. Always queries the real
 * (or mocked) `httpd.exe -M` output and reports missing modules back to the
 * caller so the admin screen can show the exact cause instead of the
 * system silently mis-configuring something.
 */
export class ApacheModuleInspector {
  constructor(private readonly runner: ApacheCommandRunner) {}

  async check(): Promise<ModuleCheckResult> {
    const result = await this.runner.getModules();
    const raw = result.stdout;
    // Real `httpd -M` output starts with a "Loaded Modules:" header line
    // before the per-module lines (each ending in "(static)"/"(shared)").
    // Only parse lines that actually look like a module entry, so the
    // header (or any other stray line) never gets treated as a module name.
    const loadedModules = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /\((static|shared)\)$/.test(line))
      .map((line) => line.split(' ')[0]);

    const missingRequired = REQUIRED_MODULES.filter(
      (mod) => !loadedModules.includes(mod)
    );
    const websocketSupported = loadedModules.includes(WEBSOCKET_MODULE);

    return { raw, loadedModules, missingRequired, websocketSupported };
  }
}
