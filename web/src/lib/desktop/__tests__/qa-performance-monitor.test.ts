import { describe, expect, it } from 'vitest';
import { DesktopQaMonitor } from '../qa-performance-monitor';

describe('Phase 1E desktop QA evidence', () => {
  it('tracks outcomes and exports no structural model content', () => {
    const monitor = new DesktopQaMonitor();
    const a = monitor.beginNativeQa(12, 18, true);
    monitor.finishNativeQa(a, 'complete', 93.4);
    const b = monitor.beginNativeQa(12, 18, true);
    monitor.finishNativeQa(b, 'discarded', 37.1, 'Model changed');
    const evidence = monitor.evidence();
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.runs).toHaveLength(2);
    expect(evidence.runs[0]).toMatchObject({ nodes: 12, members: 18, outcome: 'complete', elapsedMs: 93.4 });
    expect(evidence.runs[1].outcome).toBe('discarded');
    expect(JSON.stringify(evidence)).not.toContain('member coordinates');
    expect(evidence.scope.join(' ')).toContain('WebView2');
  });
  it('does not attach an invalid time or expose overly long error message', () => {
    const monitor = new DesktopQaMonitor();
    const id = monitor.beginNativeQa(3, 2, false);
    monitor.finishNativeQa(id, 'error', Number.POSITIVE_INFINITY, 'x'.repeat(600));
    const item = monitor.evidence().runs[0];
    expect(item.elapsedMs).toBeUndefined();
    expect(item.message?.length).toBeLessThanOrEqual(400);
  });
});
