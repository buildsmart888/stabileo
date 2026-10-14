<script lang="ts">
  import { onMount } from 'svelte';
  import { runNativeQa3D } from '../../lib/desktop/native-qa';
  import { desktopQaMonitor, type QaSample } from '../../lib/desktop/qa-performance-monitor';
  import { uiStore } from '../../lib/store';
  let showMetrics = $state(false);
  let exporting = $state(false);
  let activeQaCalls = 0;
  let sample = $state<QaSample>({
    at: '', uiRafFps: null, p95UiFrameMs: null, longFramesOver50ms: 0,
    tauriCpuPercent: null, tauriResidentMiB: null
  });
  type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  type DesktopWindow = Window & { __TAURI__?: { core?: { invoke: NativeInvoke } } };
  const num = (v: number | null, unit: string) => v == null ? 'n/a' : v.toFixed(1) + unit;

  async function startNativeQa(): Promise<void> {
    activeQaCalls += 1;
    desktopQaMonitor.start();
    try { await runNativeQa3D(); }
    finally {
      activeQaCalls -= 1;
      if (activeQaCalls === 0 && !showMetrics) desktopQaMonitor.stop();
    }
  }
  function toggleMetrics(): void {
    showMetrics = !showMetrics;
    if (showMetrics) desktopQaMonitor.start();
    else if (activeQaCalls === 0) desktopQaMonitor.stop();
  }

  async function exportEvidence(): Promise<void> {
    if (exporting) return;
    exporting = true;
    try {
      const invoke = (window as DesktopWindow).__TAURI__?.core?.invoke;
      if (!invoke) throw new Error('Native exporter not available');
      const contents = JSON.stringify(desktopQaMonitor.evidence(), null, 2);
      const path = await invoke<string | null>('desktop_export_file', {
        filename: 'GO_Phase1E_QA_' + new Date().toISOString().slice(0, 10) + '.json',
        format: 'json', contents
      });
      if (path) uiStore.toast('QA evidence saved: ' + path, 'success');
    } catch (error) {
      uiStore.toast('QA evidence export failed: ' + String(error), 'error');
    } finally {
      exporting = false;
    }
  }

  onMount(() => {
    const unsubscribe = desktopQaMonitor.subscribe(s => { sample = s; });
    // Avoid a permanent animation loop when QA monitoring is not requested.
    return () => {
      unsubscribe();
      desktopQaMonitor.stop();
    };
  });
</script>

<div class="native-qa">
  <button type="button" class="qa-solve" onclick={() => void startNativeQa()}
    title="Explicit QA action for the current 3D model; WASM remains the regular solver">
    Native QA Solve 3D
  </button>
  <button type="button" onclick={toggleMetrics}
    aria-expanded={showMetrics} title="Performance telemetry and evidence export">
    QA Metrics
  </button>
  <span class="qa-inline" title="UI requestAnimationFrame cadence, not WebGL rendering FPS; CPU and RAM measure the native Tauri host only">
    UI {num(sample.uiRafFps, ' fps')} · CPU {num(sample.tauriCpuPercent, '%')} · Native RAM {num(sample.tauriResidentMiB, ' MiB')}
  </span>

  {#if showMetrics}
    <section class="qa-panel" role="dialog" aria-label="Desktop Native QA performance monitor">
      <div class="qa-head">
        <strong>Engineering QA telemetry</strong>
        <button type="button" onclick={() => showMetrics = false} aria-label="Close QA metrics">Close</button>
      </div>
      <div class="qa-grid">
        <span>UI rAF cadence<strong>{num(sample.uiRafFps, ' fps')}</strong></span>
        <span>UI p95 frame interval<strong>{num(sample.p95UiFrameMs, ' ms')}</strong></span>
        <span>Frames over 50 ms / sample<strong>{sample.longFramesOver50ms}</strong></span>
        <span>Tauri host CPU<strong>{num(sample.tauriCpuPercent, '%')}</strong></span>
        <span>Tauri resident RAM<strong>{num(sample.tauriResidentMiB, ' MiB')}</strong></span>
      </div>
      <p>The UI FPS figure measures browser animation callbacks, not the actual Three.js rendered-frame rate. CPU/RAM exclude WebView2 and GPU child processes. Values are sampled for QA, not a performance acceptance certificate.</p>
      {#if sample.error}
        <p class="qa-error">Telemetry unavailable: {sample.error}</p>
      {/if}
      <button type="button" onclick={() => void exportEvidence()} disabled={exporting}>
        {exporting ? 'Saving evidence...' : 'Export QA Evidence (.json)'}
      </button>
      <small>Native QA only supports simple linear 3D frames/trusses without combinations, shells, constraints or offsets. The main WASM solver is unchanged.</small>
    </section>
  {/if}
</div>

<style>
  .native-qa{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  .qa-solve{font-weight:700;border-color:#7ad9b6!important}
  .qa-inline{font:11px/1.5 system-ui;color:#c6ddeb;white-space:nowrap;font-variant-numeric:tabular-nums}
  .qa-panel{position:fixed;top:62px;right:14px;max-width:min(530px,calc(100vw - 28px));max-height:78vh;overflow:auto;z-index:30010;padding:16px;border:1px solid #6390ae;border-radius:12px;background:#122e49;color:#eaf5ff;box-shadow:0 18px 45px #0008}
  .qa-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
  .qa-head strong{font-size:15px}
  .qa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .qa-grid span{display:flex;flex-direction:column;gap:3px;background:#214360;border-radius:7px;padding:9px;font-size:11px;color:#bcd5e6}
  .qa-grid span strong{font-size:15px;color:#fff;font-variant-numeric:tabular-nums}
  .qa-panel p,.qa-panel small{display:block;font-size:11px;line-height:1.6;color:#b9d3e7;margin:10px 0}
  .qa-panel .qa-error{color:#ffbdaf;overflow-wrap:anywhere}
</style>
