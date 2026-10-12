<script lang="ts">
  import { onMount } from 'svelte';
  import { isDesktop, desktopOpen, desktopSave, desktopRecover, desktopAutoSave } from '../../lib/desktop/bridge';
  let enabled = $state(false);
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
    <strong>GO Structural Analysis</strong>
    <span class="source">Stabileo / AGPL-3.0</span>
    <button onclick={() => void desktopOpen()}>Open Ctrl+O</button>
    <button onclick={() => void desktopSave(false)}>Save Ctrl+S</button>
    <button onclick={() => void desktopSave(true)}>Save As</button>
    <button onclick={() => void desktopRecover()}>Recovery</button>
    <span class="offline">Local solver · Offline capable</span>
  </nav>
{/if}
<style>
.go-desktop{display:flex;align-items:center;gap:9px;flex-wrap:wrap;position:relative;z-index:9999;background:#112438;color:#e7f3fc;padding:8px 14px;font:12px/1.4 system-ui;border-bottom:1px solid #47748e}
.go-desktop strong{font-size:14px;letter-spacing:.2px}.source{opacity:.7;margin-right:auto}
.go-desktop button{background:#214965;border:1px solid #5082a2;border-radius:6px;padding:7px 11px;color:#fff;cursor:pointer}
.go-desktop button:hover{background:#317499}.offline{color:#8be5bb}
</style>
