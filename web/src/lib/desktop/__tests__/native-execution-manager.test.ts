import { describe, expect, it, vi } from 'vitest';
import { NativeExecutionManager, StaleNativeResultError } from '../native-execution-manager';
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
describe('Phase 1D native execution manager', () => {
  it('runs one job and emits start and complete', async () => {
    const manager = new NativeExecutionManager();
    const phases: string[] = [];
    manager.subscribe(x => phases.push(x.phase));
    const value = await manager.submit('a', () => 'a', async () => 25);
    expect(value).toBe(25);
    expect(phases).toContain('solving');
    expect(phases).toContain('complete');
  });
  it('discards native result after revision changes', async () => {
    const manager = new NativeExecutionManager();
    const pending = deferred<number>();
    let current = 'v1';
    const out = manager.submit('v1', () => current, () => pending.promise);
    current = 'v2';
    pending.resolve(123);
    await expect(out).rejects.toBeInstanceOf(StaleNativeResultError);
  });
  it('keeps at most one Rust call running and only launches latest queued', async () => {
    const manager = new NativeExecutionManager();
    const pending = deferred<number>();
    const firstRun = vi.fn(() => pending.promise);
    const oldRun = vi.fn(async () => 2);
    const newRun = vi.fn(async () => 3);
    const first = manager.submit('1', () => '1', firstRun);
    const discarded = manager.submit('2', () => '2', oldRun);
    const discardedCheck = expect(discarded).rejects.toBeInstanceOf(StaleNativeResultError);
    const latest = manager.submit('3', () => '3', newRun);
    await discardedCheck;
    expect(firstRun).toHaveBeenCalledTimes(1);
    expect(oldRun).not.toHaveBeenCalled();
    expect(newRun).not.toHaveBeenCalled();
    pending.resolve(1);
    await expect(first).rejects.toBeInstanceOf(StaleNativeResultError);
    expect(await latest).toBe(3);
    expect(newRun).toHaveBeenCalledTimes(1);
  });
  it('cancel invalidates running output without stopping Rust thread', async () => {
    const manager = new NativeExecutionManager();
    const pending = deferred<string>();
    const out = manager.submit('a', () => 'a', () => pending.promise);
    manager.cancel();
    pending.resolve('should not display');
    await expect(out).rejects.toBeInstanceOf(StaleNativeResultError);
  });
  it('surfaces errors without silently falling back to WASM', async () => {
    const manager = new NativeExecutionManager();
    const fail = manager.submit('a', () => 'a', async () => { throw new Error('singular matrix'); });
    await expect(fail).rejects.toThrow('singular matrix');
  });
  it('rejects missing revision key', async () => {
    const manager = new NativeExecutionManager();
    await expect(manager.submit('', () => '', async () => 1)).rejects.toThrow('Missing model revision');
    await tick();
  });
});
