/** Phase 1B: opt-in native FEM boundary. Existing WASM production path is unchanged. */
import type { SolverInput, AnalysisResults } from '../engine/types';
import type { SolverInput3D, AnalysisResults3D } from '../engine/types-3d';
import { serializeInput3D } from '../engine/wasm-solver';
import { nativeExecutionManager } from './native-execution-manager';

type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type DesktopWindow = Window & { __TAURI__?: { core?: { invoke: NativeInvoke } } };

export function hasNativeLinearSolver(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as DesktopWindow).__TAURI__?.core?.invoke === 'function';
}

function encodeMap(map: Map<number, unknown>): Record<string, unknown> {
  return Object.fromEntries(map.entries().map(([id, value]) => [String(id), value]));
}

export function serializeNative2D(input: SolverInput): string {
  return JSON.stringify({
    nodes: encodeMap(input.nodes), materials: encodeMap(input.materials),
    sections: encodeMap(input.sections), elements: encodeMap(input.elements),
    supports: encodeMap(input.supports), loads: input.loads,
    constraints: input.constraints ?? [],
    connectors: input.connectors ? encodeMap(input.connectors) : {}
  });
}

export async function nativeSolve2D(input: SolverInput): Promise<AnalysisResults> {
  if (!hasNativeLinearSolver()) throw new Error('Native Rust solver requires Tauri Desktop.');
  const invoke = (window as DesktopWindow).__TAURI__!.core!.invoke;
  const json = await invoke<string>('desktop_solve_linear', { mode: '2d', inputJson: serializeNative2D(input) });
  return JSON.parse(json) as AnalysisResults;
}

export async function nativeSolve3D(input: SolverInput3D): Promise<AnalysisResults3D> {
  if (!hasNativeLinearSolver()) throw new Error('Native Rust solver requires Tauri Desktop.');
  const invoke = (window as DesktopWindow).__TAURI__!.core!.invoke;
  const json = await invoke<string>('desktop_solve_linear', { mode: '3d', inputJson: serializeInput3D(input) });
  return JSON.parse(json) as AnalysisResults3D;
}

/** Opt-in safe 3D native execution. Supply an immutable revision fingerprint of
 * the input and a callback giving the currently active model fingerprint.
 * Callers MUST update the revision on any model edit or tab change.
 */
export function queuedNativeSolve3D(
  input: SolverInput3D,
  revision: string,
  currentRevision: () => string
): Promise<AnalysisResults3D> {
  return nativeExecutionManager.submit(revision, currentRevision, () => nativeSolve3D(input));
}

/** Equivalent guarded linear 2D path; does not silently fall back to WASM. */
export function queuedNativeSolve2D(
  input: SolverInput,
  revision: string,
  currentRevision: () => string
): Promise<AnalysisResults> {
  return nativeExecutionManager.submit(revision, currentRevision, () => nativeSolve2D(input));
}
