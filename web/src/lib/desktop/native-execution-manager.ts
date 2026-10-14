/**
 * Phase 1D: latest-request-wins scheduler for opt-in native QA.
 * Native FEM threads are not force-killed: "Cancel" invalidates the result.
 * Only one job is running at a time; a newer queued job replaces old queued work.
 * No result can be committed unless the model revision still matches.
 */
export type ExecutionPhase = 'idle' | 'queued' | 'solving' | 'complete' | 'cancelled' | 'stale' | 'error';
export type NativeExecutionStatus = {
  phase: ExecutionPhase;
  requestId: number;
  message: string;
  startedAt?: number;
  elapsedMs?: number;
};
export class StaleNativeResultError extends Error {
  constructor() { super('Native solve result discarded: model changed or request superseded.'); }
}
type Job<T> = {
  id: number; revision: string; run: () => Promise<T>;
  currentRevision: () => string;
  resolve: (value: T) => void; reject: (reason: unknown) => void;
};
export class NativeExecutionManager {
  private nextId = 0;
  private active: Job<unknown> | undefined;
  private pending: Job<unknown> | undefined;
  private cancelled = new Set<number>();
  private status: NativeExecutionStatus = { phase: 'idle', requestId: 0, message: 'Native solver ready' };
  private listeners = new Set<(status: NativeExecutionStatus) => void>();
  subscribe(callback: (status: NativeExecutionStatus) => void): () => void {
    this.listeners.add(callback);
    callback({ ...this.status });
    return () => this.listeners.delete(callback);
  }
  private publish(state: NativeExecutionStatus): void {
    this.status = state;
    for (const listener of this.listeners) listener({ ...state });
  }
  submit<T>(revision: string, currentRevision: () => string, run: () => Promise<T>): Promise<T> {
    if (!revision || !revision.trim()) return Promise.reject(new Error('Missing model revision key.'));
    const id = ++this.nextId;
    // Cancel old queued request immediately; never start its Rust work.
    if (this.pending) {
      // Queued work never started; rejecting immediately is sufficient.
      // Do not retain its ID in the cancelled set (would leak on every edit).
      this.pending.reject(new StaleNativeResultError());
      this.pending = undefined;
    }
    // Running Rust call completes but its outcome is discarded.
    if (this.active) this.cancelled.add(this.active.id);
    return new Promise<T>((resolve, reject) => {
      const job: Job<T> = { id, revision, currentRevision, run, resolve, reject };
      this.pending = job as Job<unknown>;
      this.publish({ phase: 'queued', requestId: id, message: 'Waiting for native solver' });
      void this.pump();
    });
  }
  cancel(): void {
    if (!this.pending && !this.active) return;
    if (this.pending) {
      this.pending.reject(new StaleNativeResultError());
      this.pending = undefined;
    }
    if (this.active) this.cancelled.add(this.active.id);
    this.publish({ phase: 'cancelled', requestId: this.nextId, message: 'Result invalidated; running Rust calculation may continue' });
  }
  private async pump(): Promise<void> {
    if (this.active || !this.pending) return;
    const job = this.pending;
    this.pending = undefined;
    if (this.cancelled.delete(job.id) || job.currentRevision() !== job.revision) {
      job.reject(new StaleNativeResultError());
      this.publish({ phase: 'stale', requestId: job.id, message: 'Input revision changed before solve' });
      void this.pump();
      return;
    }
    this.active = job;
    const startedAt = Date.now();
    this.publish({ phase: 'solving', requestId: job.id, message: 'Native FEM calculation in progress', startedAt });
    try {
      const result = await job.run();
      // Revision checked AFTER async Rust computation; invalid results never applied.
      const stale = this.cancelled.has(job.id) || job.id !== this.nextId ||
        job.currentRevision() !== job.revision;
      if (stale) {
        job.reject(new StaleNativeResultError());
        if (job.id === this.nextId) this.publish({ phase: 'stale', requestId: job.id, message: 'Outdated native result discarded' });
      } else {
        job.resolve(result);
        this.publish({ phase: 'complete', requestId: job.id, message: 'Native FEM solve finished', startedAt, elapsedMs: Date.now() - startedAt });
      }
    } catch (error) {
      const stale = this.cancelled.has(job.id) || job.id !== this.nextId ||
        job.currentRevision() !== job.revision;
      job.reject(stale ? new StaleNativeResultError() : error);
      if (!stale) this.publish({ phase: 'error', requestId: job.id, message: String(error), startedAt, elapsedMs: Date.now() - startedAt });
    } finally {
      this.cancelled.delete(job.id);
      this.active = undefined;
      // Launch the next request only AFTER the active native call has settled.
      void this.pump();
    }
  }
}
export const nativeExecutionManager = new NativeExecutionManager();
