/**
 * Phase 1E field telemetry for Desktop QA.
 * UI rAF cadence measures renderer responsiveness, NOT WebGL draw FPS.
 * CPU and resident memory sample only the Tauri host process, not WebView2.
 */
export interface ProcessMetric {
  pid: number;
  cpuPercent: number | null;
  residentBytes: number;
  warmedUp: boolean;
}
export interface QaSample {
  at: string;
  uiRafFps: number | null;
  p95UiFrameMs: number | null;
  longFramesOver50ms: number;
  tauriCpuPercent: number | null;
  tauriResidentMiB: number | null;
  error?: string;
}
export interface QaRun {
  id: number;
  startedAt: string;
  finishedAt?: string;
  mode: '3d-linear';
  nodes: number;
  members: number;
  selfWeight: boolean;
  outcome: 'running' | 'complete' | 'discarded' | 'error';
  elapsedMs?: number;
  message?: string;
}
type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type DesktopGlobal = Window & { __TAURI__?: { core?: { invoke: NativeInvoke } } };

export class DesktopQaMonitor {
  private raf: number | null = null;
  private timer: number | null = null;
  private lastFrame: number | null = null;
  private frameDeltas: number[] = [];
  private sampling = false;
  private samples: QaSample[] = [];
  private runs: QaRun[] = [];
  private nextRunId = 0;
  private latest: QaSample = {
    at: '', uiRafFps: null, p95UiFrameMs: null,
    longFramesOver50ms: 0, tauriCpuPercent: null, tauriResidentMiB: null
  };
  private listeners = new Set<(sample: QaSample) => void>();

  subscribe(listener: (sample: QaSample) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.latest });
    return () => { this.listeners.delete(listener); };
  }
  private frame = (now: number): void => {
    if (this.lastFrame != null && document.visibilityState === 'visible') {
      const delta = now - this.lastFrame;
      if (delta > 0 && delta < 2000) {
        this.frameDeltas.push(delta);
        if (this.frameDeltas.length > 180) this.frameDeltas.shift();
      }
    }
    this.lastFrame = now;
    this.raf = window.requestAnimationFrame(this.frame);
  };
  start(): void {
    if (this.raf != null || typeof window === 'undefined') return;
    this.raf = window.requestAnimationFrame(this.frame);
    this.timer = window.setInterval(() => { void this.poll(); }, 1000);
    void this.poll();
  }
  stop(): void {
    if (this.raf != null) window.cancelAnimationFrame(this.raf);
    if (this.timer != null) window.clearInterval(this.timer);
    this.raf = null;
    this.timer = null;
    this.lastFrame = null;
    this.frameDeltas = [];
  }
  private async poll(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    let cpu: number | null = null;
    let rss: number | null = null;
    let error: string | undefined;
    const deltas = [...this.frameDeltas];
    this.frameDeltas = [];
    const visible = document.visibilityState === 'visible';
    let fps: number | null = null;
    let p95: number | null = null;
    if (visible && deltas.length >= 2) {
      const sorted = deltas.slice().sort((a, b) => a - b);
      const avg = deltas.reduce((sum, x) => sum + x, 0) / deltas.length;
      fps = avg > 0 ? Math.round(10000 / avg) / 10 : null;
      p95 = Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 10) / 10;
    }
    try {
      const invoke = (window as DesktopGlobal).__TAURI__?.core?.invoke;
      if (!invoke) throw new Error('Native process telemetry not available');
      const process = await invoke<ProcessMetric>('desktop_process_metrics');
      if (!Number.isFinite(process.residentBytes) || process.residentBytes < 0) {
        throw new Error('Invalid native memory sample');
      }
      cpu = process.warmedUp && process.cpuPercent != null &&
        Number.isFinite(process.cpuPercent) ? process.cpuPercent : null;
      rss = Math.round(process.residentBytes / 104857.6) / 10;
    } catch (cause) {
      error = String(cause);
    } finally {
      const sample: QaSample = {
        at: new Date().toISOString(), uiRafFps: fps, p95UiFrameMs: p95,
        longFramesOver50ms: deltas.filter(x => x > 50).length,
        tauriCpuPercent: cpu, tauriResidentMiB: rss, ...(error ? { error } : {})
      };
      this.latest = sample;
      this.samples.push(sample);
      if (this.samples.length > 1800) this.samples.shift();
      for (const listener of this.listeners) listener({ ...sample });
      this.sampling = false;
    }
  }
  beginNativeQa(nodes: number, members: number, selfWeight: boolean): number {
    const id = ++this.nextRunId;
    this.runs.push({
      id, startedAt: new Date().toISOString(), mode: '3d-linear',
      nodes, members, selfWeight, outcome: 'running'
    });
    if (this.runs.length > 100) this.runs.shift();
    return id;
  }
  finishNativeQa(id: number, outcome: 'complete' | 'discarded' | 'error',
    elapsedMs?: number, message?: string): void {
    const run = this.runs.find(item => item.id === id);
    if (!run) return;
    run.outcome = outcome;
    run.finishedAt = new Date().toISOString();
    if (elapsedMs != null && Number.isFinite(elapsedMs)) run.elapsedMs = elapsedMs;
    if (message) run.message = message.slice(0, 400);
  }
  evidence(): { schemaVersion: number; createdAt: string; scope: string[];
    samples: QaSample[]; runs: QaRun[] } {
    return {
      schemaVersion: 1, createdAt: new Date().toISOString(),
      scope: [
        'UI rAF tick rate only, not actual 3D WebGL rendered FPS',
        'Tauri host process CPU and resident RAM only, WebView2/GPU processes excluded',
        'CPU percent is unnormalized and may exceed 100% on multiple cores',
        'Elapsed time includes Tauri IPC, serialization and solver, not pure FEM time',
        'QA measurements are not engineering certification or performance acceptance'
      ],
      samples: this.samples.map(x => ({ ...x })),
      runs: this.runs.map(x => ({ ...x }))
    };
  }
}
export const desktopQaMonitor = new DesktopQaMonitor();
