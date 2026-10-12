/**
 * Native Save-dialog adapter for desktop exports.
 * No arbitrary paths from JavaScript are accepted by the Rust backend.
 * Web builds do not import Tauri runtime packages or acquire filesystem permissions.
 */
type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriWindow = Window & { __TAURI__?: { core?: { invoke: NativeInvoke } } };

export function isNativeDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as TauriWindow).__TAURI__?.core?.invoke;
}

export async function nativeSaveExport(
  filename: string,
  format: 'xlsx' | 'html',
  contents: string
): Promise<string | null> {
  if (typeof window === 'undefined') throw new Error('Desktop window unavailable.');
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('Tauri native file export is not available.');
  return invoke<string | null>('desktop_export_file', { filename, format, contents });
}
