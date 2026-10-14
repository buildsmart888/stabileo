<script lang="ts">
  import { nativeSaveExport } from '../../lib/desktop/native-file';
  import { uiStore } from '../../lib/store';

  let { html = $bindable(''), title = 'Structural Calculation Report' }:
    { html: string; title?: string } = $props();

  let reportFrame: HTMLIFrameElement;

  function printReport() {
    const content = reportFrame?.contentWindow;
    if (!content) {
      uiStore.toast('Report preview is not ready yet.', 'error');
      return;
    }
    // Browser/WebView2 print dialog: choose Microsoft Print to PDF / Save as PDF.
    content.focus();
    content.print();
  }

  async function saveHtmlCopy() {
    try {
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Structural-report';
      const path = await nativeSaveExport(safeTitle + '.html', 'html', html);
      if (path) uiStore.toast('HTML report saved: ' + path, 'success');
    } catch (error) {
      uiStore.toast('Cannot save HTML report: ' + String(error), 'error');
    }
  }
</script>

{#if html}
  <div class="report-overlay" role="presentation">
    <section class="report-shell" role="dialog" aria-modal="true" aria-label="Calculation report preview">
      <header class="report-toolbar">
        <div class="report-heading">
          <strong>Calculation Report</strong>
          <small>Preview · Print or save as PDF with the Windows print dialog</small>
        </div>
        <button class="print" onclick={printReport}>Print / Save as PDF</button>
        <button onclick={() => void saveHtmlCopy()}>Save HTML</button>
        <button class="close" onclick={() => html = ''} aria-label="Close report preview">Close</button>
      </header>
      <iframe
        bind:this={reportFrame}
        srcdoc={html}
        title="Printable calculation report"
        sandbox="allow-same-origin allow-modals"
      ></iframe>
    </section>
  </div>
{/if}

<style>
  .report-overlay { position: fixed; inset: 0; z-index: 30000; background: rgba(0,0,0,.78); padding: 16px; display: flex; }
  .report-shell { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; background:#e7eef6; border-radius:10px; overflow:hidden; box-shadow:0 20px 70px #0008; }
  .report-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 14px; background:#10253a; color:white; }
  .report-heading { margin-right:auto; display:flex; flex-direction:column; gap:3px; min-width:200px; }
  .report-heading small { font-size:11px; color:#a9c5db; }
  button { border:1px solid #527c9b; background:#214c69; color:white; border-radius:6px; padding:8px 12px; cursor:pointer; font-size:12px; }
  button:hover { background:#336c92; }
  .print { background:#176a58; border-color:#3eaa91; font-weight:600; }
  .print:hover { background:#238b70; }
  .close { background:#463d4e; }
  iframe { flex:1; width:100%; min-height:0; background:white; border:0; }
</style>
