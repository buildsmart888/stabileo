import { modelStore, tabManager, uiStore } from '../store';
import { serializeProject, loadFile } from '../store/file';
type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
type Opened = { filename: string; content: string };
declare global { interface Window { __TAURI__?: { core?: { invoke: Invoke } } } }
const native = (): Invoke | undefined => window.__TAURI__?.core?.invoke;
export const isDesktop = (): boolean => typeof window !== 'undefined' && !!native();
const currentTabId = () => String(tabManager.activeTabId || 'default').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
async function restoreContent(opened: Opened, associate: boolean) {
  const file = new File([opened.content], opened.filename, { type: 'application/json' });
  const result = await loadFile(file);
  if (associate && result.type === 'tab') await native()!('desktop_commit_open', { tabId: currentTabId() });
  else if (associate) await native()!('desktop_abort_open');
  tabManager.syncActiveTabName();
  uiStore.toast('Opened: ' + opened.filename, 'success');
}
export async function desktopOpen(): Promise<void> {
  const invoke = native(); if (!invoke) return;
  try {
    const opened = await invoke<Opened | null>('desktop_pick_project');
    if (!opened) return;
    try { await restoreContent(opened, true); }
    catch (error) { await invoke('desktop_abort_open'); throw error; }
  } catch (error) { uiStore.toast(String(error), 'error'); }
}
export async function desktopSave(saveAs: boolean): Promise<void> {
  const invoke = native(); if (!invoke) return;
  try {
    const path = await invoke<string | null>('desktop_save_project', {
      tabId: currentTabId(), content: serializeProject(),
      suggestedName: modelStore.model.name, saveAs
    });
    if (path) uiStore.toast('Saved: ' + path, 'success');
  } catch (error) { uiStore.toast('Save failed: ' + String(error), 'error'); }
}
export async function desktopRecover(): Promise<void> {
  const invoke = native(); if (!invoke) return;
  try {
    const opened = await invoke<Opened | null>('desktop_pick_recovery');
    if (opened) await restoreContent(opened, false);
  } catch (error) { uiStore.toast('Recovery failed: ' + String(error), 'error'); }
}
/** Recovery saves report their status so silent disk failures cannot go unnoticed. */
export interface RecoverySaveStatus {
  status: 'saved' | 'unchanged' | 'error';
  at: number;
  message?: string;
}
function reportSaveStatus(detail: RecoverySaveStatus): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<RecoverySaveStatus>('go-desktop-autosave-status', { detail }));
  }
}

let inFlight = false;
export async function desktopAutoSave(): Promise<void> {
  const invoke = native(); if (!invoke || inFlight) return;
  inFlight = true;
  try {
    const written = await invoke<boolean>('desktop_autosave', {
      tabId: currentTabId(), content: serializeProject()
    });
    reportSaveStatus({ status: written ? 'saved' : 'unchanged', at: Date.now() });
  } catch (error) {
    const message = String(error);
    console.error('Desktop recovery snapshot failed:', error);
    reportSaveStatus({ status: 'error', at: Date.now(), message });
  } finally { inFlight = false; }
}


export interface RecoveryEntry {
  id: string;
  modelName: string;
  modifiedAtMs: number;
  bytes: number;
}

/** Read-only metadata; do not restore/overwrite a tab without user consent. */
export async function desktopListRecovery(): Promise<RecoveryEntry[]> {
  const invoke = native();
  if (!invoke) return [];
  return invoke<RecoveryEntry[]>('desktop_list_recovery');
}

/** Restores a snapshot explicitly chosen in the Recovery dialog, with normal .ded validation. */
export async function desktopRecoverById(id: string): Promise<boolean> {
  const invoke = native();
  if (!invoke) return false;
  try {
    const opened = await invoke<Opened>('desktop_read_recovery', { id });
    await restoreContent(opened, false);
    uiStore.toast('Recovery snapshot restored. Save As to keep this version.', 'info');
    return true;
  } catch (error) {
    uiStore.toast('Recovery failed: ' + String(error), 'error');
    return false;
  }
}
