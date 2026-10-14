<script lang="ts">
  import { onMount } from 'svelte';
  import { downloadExcel } from '../../lib/store/file';
  import CalcReportDialog from '../CalcReportDialog.svelte';
  import { isDesktop, desktopOpen, desktopSave, desktopAutoSave, desktopListRecovery, desktopRecoverById, type RecoveryEntry } from '../../lib/desktop/bridge';
  let enabled = $state(false);
  let showPdfReport = $state(false);
  let showRecovery = $state(false);
  let loadingRecovery = $state(false);
  let recoveryFiles = $state<RecoveryEntry[]>([]);
  let recoveryError = $state('');

  async function openRecoveryPanel() {
    showRecovery = true;
    loadingRecovery = true;
    recoveryError = '';
    try { recoveryFiles = await desktopListRecovery(); }
    catch (error) { recoveryFiles = []; recoveryError = String(error); }
    finally { loadingRecovery = false; }
  }

  async function restoreRecovery(id: string) {
    // The button is explicit consent; do not silently replace an unsaved model.
    if (!window.confirm('Replace the CURRENT tab with this recovery snapshot? Save your current model first if needed.')) return;
    const restored = await desktopRecoverById(id);
    if (restored) showRecovery = false;
  }

  const displayTime = (ms: number) => ms ? new Date(ms).toLocaleString() : 'Unknown date';
  onMount(() => {
    enabled = isDesktop();
    if (!enabled) return;
    const autoSave = setInterval(() => { void desktopAutoSave(); }, 30000);
    const keydown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault(); e.stopImmediatePropagation(); void desktopOpen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); e.stopImmediatePropagation(); void desktopSave(e.shiftKey);
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => { clearInterval(autoSave); window.removeEventListener('keydown', keydown, true); };
  });
</script>
{#if enabled}
  <nav class="go-desktop" aria-label="Desktop file commands">
    <strong>GO Structural Analysis <span class="go-version">v0.1.1 QA</span></strong>
    <span class="source">Stabileo / AGPL-3.0</span>
    <button onclick={() => void desktopOpen()}>Open Ctrl+O</button>
    <button onclick={() => void desktopSave(false)}>Save Ctrl+S</button>
    <button onclick={() => void desktopSave(true)}>Save As</button>
    <button onclick={() => void openRecoveryPanel()}>Recovery</button>
    <button onclick={downloadExcel}>Excel</button>
    <button onclick={() => showPdfReport = true}>PDF Report</button>
    <span class="offline">Local solver · Offline capable</span>
  </nav>
  <CalcReportDialog bind:open={showPdfReport} />
  {#if showRecovery}
    <div class="recovery-overlay">
      <section class="recovery-dialog" role="dialog" aria-modal="true" aria-label="Recovery snapshots">
        <div class="recovery-heading">
          <h3>Recovery snapshots</h3>
          <button onclick={() => showRecovery = false} aria-label="Close recovery">Close</button>
        </div>
        <p>Snapshots are saved for the active tab about every 30 seconds in local app data. Restoring replaces the current tab. Save your current work first.</p>
        {#if loadingRecovery}
          <p>Checking recovery files...</p>
        {:else if recoveryError}
          <p class="recovery-error">{recoveryError}</p>
        {:else if recoveryFiles.length === 0}
          <p>No recovery files found yet. Keep a model open for at least 30 seconds and try again.</p>
        {:else}
          <div class="recovery-items">
            {#each recoveryFiles as item (item.id)}
              <div class="recovery-item">
                <div class="recovery-meta">
                  <strong>{item.modelName}</strong>
                  <small>{displayTime(item.modifiedAtMs)} · {Math.round(item.bytes / 1024)} KB · {item.id}</small>
                </div>
                <button onclick={() => void restoreRecovery(item.id)}>Restore</button>
              </div>
            {/each}
          </div>
        {/if}
        <div class="recovery-footer">
          <button onclick={() => void openRecoveryPanel()}>Refresh</button>
          <button onclick={() => showRecovery = false}>Cancel</button>
        </div>
      </section>
    </div>
  {/if}
{/if}
<style>
.go-desktop{display:flex;align-items:center;gap:9px;flex-wrap:wrap;position:relative;z-index:9999;background:#112438;color:#e7f3fc;padding:8px 14px;font:12px/1.4 system-ui;border-bottom:1px solid #47748e}
.go-desktop strong{font-size:14px;letter-spacing:.2px}.go-version{color:#7ad9b6;font-size:10px;font-weight:500}.source{opacity:.7;margin-right:auto}
.go-desktop button{background:#214965;border:1px solid #5082a2;border-radius:6px;padding:7px 11px;color:#fff;cursor:pointer}
.go-desktop button:hover{background:#317499}.offline{color:#8be5bb}
  .recovery-overlay{position:fixed;inset:0;z-index:30001;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px}
  .recovery-dialog{background:#152b42;color:#e4f2ff;border:1px solid #47748e;border-radius:10px;padding:20px;width:min(640px,100%);max-height:85vh;overflow:auto;box-shadow:0 15px 60px #0008}
  .recovery-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}
  .recovery-heading h3{margin:0;font-size:18px}
  .recovery-dialog p{font-size:13px;line-height:1.5;color:#b6cad9}
  .recovery-items{display:flex;flex-direction:column;gap:7px}
  .recovery-item{display:flex;align-items:center;gap:12px;justify-content:space-between;background:#213e58;padding:10px;border-radius:8px}
  .recovery-meta{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}
  .recovery-meta strong{font-size:13px}.recovery-meta small{font-size:11px;color:#b6d4e7}
  .recovery-dialog button{background:#24577a;border:1px solid #568cad;border-radius:6px;color:white;cursor:pointer;padding:7px 11px}
  .recovery-dialog button:hover{background:#347da5}
  .recovery-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  .recovery-error{color:#ffb3b3!important}
</style>
