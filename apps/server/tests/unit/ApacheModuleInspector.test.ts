import { describe, expect, it } from 'vitest';
import { ApacheModuleInspector } from '../../src/services/apache/ApacheModuleInspector';
import { MockApacheCommandRunner } from '../../src/services/apache/MockApacheCommandRunner';

describe('ApacheModuleInspector', () => {
  it('reports no missing modules and WebSocket support when everything is loaded', async () => {
    const inspector = new ApacheModuleInspector(new MockApacheCommandRunner());
    const result = await inspector.check();
    expect(result.missingRequired).toEqual([]);
    expect(result.websocketSupported).toBe(true);
  });

  it('reports missing required modules and no WebSocket support when the module list omits them', async () => {
    const runner = new MockApacheCommandRunner({
      modulesResult: {
        code: 0,
        stdout: ['core_module (static)', 'rewrite_module (shared)'].join('\n'),
        stderr: '',
      },
    });
    const inspector = new ApacheModuleInspector(runner);
    const result = await inspector.check();
    expect(result.missingRequired).toEqual(
      expect.arrayContaining(['proxy_module', 'proxy_http_module', 'ssl_module'])
    );
    expect(result.missingRequired).not.toContain('rewrite_module');
    expect(result.websocketSupported).toBe(false);
  });

  it('ignores the "Loaded Modules:" header line from real httpd -M output', async () => {
    // Regression test: real Apache Lounge builds prefix the module list
    // with this header line, which used to be mis-parsed as a bogus
    // module named "Loaded" (found by testing against a real XAMPP
    // install rather than only the mock).
    const runner = new MockApacheCommandRunner({
      modulesResult: {
        code: 0,
        stdout: [
          'Loaded Modules:',
          ' core_module (static)',
          ' proxy_module (shared)',
          ' rewrite_module (shared)',
          ' ssl_module (shared)',
        ].join('\n'),
        stderr: '',
      },
    });
    const inspector = new ApacheModuleInspector(runner);
    const result = await inspector.check();
    expect(result.loadedModules).not.toContain('Loaded');
    expect(result.missingRequired).toEqual(['proxy_http_module']);
  });
});
