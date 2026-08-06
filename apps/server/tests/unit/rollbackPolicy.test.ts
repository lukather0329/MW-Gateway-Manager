import { describe, expect, it } from 'vitest';
import { shouldAutoRollback } from '../../src/services/apache/ApacheRollbackService';

describe('shouldAutoRollback (spec 6.8 policy)', () => {
  it('auto-rolls-back on Apache-level failures', () => {
    expect(shouldAutoRollback('SYNTAX_ERROR')).toBe(true);
    expect(shouldAutoRollback('FILE_WRITE_FAILED')).toBe(true);
    expect(shouldAutoRollback('GRACEFUL_RELOAD_FAILED')).toBe(true);
    expect(shouldAutoRollback('PROCESS_NOT_RUNNING')).toBe(true);
  });

  it('does NOT auto-roll-back when only the target program is unreachable', () => {
    expect(shouldAutoRollback('TARGET_CONNECTIVITY_FAILED')).toBe(false);
  });
});
