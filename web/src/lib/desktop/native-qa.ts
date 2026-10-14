/**
 * Actual current-model Native QA execution for Desktop 3D.
 * Never replaces the production WASM Solve button. A safe subset of models
 * only: linear, single unfactored 3D frame/truss cases, no advanced geometry.
 */
import { modelStore, resultsStore, tabManager, uiStore, verificationStore } from '../store';
import { serializeInput3D } from '../engine/wasm-solver';
import { modelHasMemberOffsets } from '../engine/member-offsets';
import { modelHasJoints3D } from '../engine/expand-joints-3d';
import { nativeExecutionManager, StaleNativeResultError } from './native-execution-manager';
import { hasNativeLinearSolver, nativeSolve3DJson } from './native-solver';
import { validateNative3DResult } from './native-qa-validation';
import { desktopQaMonitor } from './qa-performance-monitor';

export function nativeQa3DEligibility(): string | null {
  if (!hasNativeLinearSolver()) return 'Native solver is available only in an updated Tauri Desktop build.';
  if (uiStore.analysisMode !== '3d' && uiStore.analysisMode !== 'pro') {
    return 'Switch to a 3D or Professional model for Native QA.';
  }
  if (uiStore.liveCalc) return 'Disable Live Calculation before running Native QA.';
  if (modelStore.nodes.size < 2 || modelStore.elements.size < 1 || modelStore.supports.size < 1) {
    return 'Native QA needs at least two nodes, one member and one support.';
  }
  if (modelStore.combinations.length > 0 || modelStore.loadCases.length > 1) {
    return 'Native QA is limited to one unfactored load case (no load combinations). Use the WASM solver for combinations.';
  }
  if (modelStore.plates.size > 0 || modelStore.quads.size > 0) {
    return 'Native QA does not yet cover shell/plate postprocessing. Use the standard solver.';
  }
  if (modelStore.constraints.length > 0 || modelStore.connectors.size > 0) {
    return 'Native QA currently excludes joints via constraint/connector primitives.';
  }
  if (modelStore.hasSlidingJoints() ||
      modelHasMemberOffsets(modelStore.elements.values()) ||
      modelHasJoints3D(modelStore.elements.values())) {
    return 'Native QA currently excludes sliding joints, rigid offsets and 3D joint expansions.';
  }
  return null;
}

function currentModelRevision(): string {
  // Canonical snapshot of ALL model data, not just the solver input, plus
  // tab and analysis options. Any user edit/mode change invalidates pending QA.
  // Full equality avoids collisions from short revision hashes.
  return JSON.stringify({
    tabId: String(tabManager.activeTabId ?? ''),
    mode: uiStore.analysisMode,
    selfWeight: uiStore.includeSelfWeight,
    leftHand: uiStore.axisConvention3D === 'leftHand',
    liveCalc: uiStore.liveCalc,
    model: modelStore.snapshot()
  });
}

export async function runNativeQa3D(): Promise<void> {
  let runId: number | undefined;
  let start = 0;
  try {
    const ineligible = nativeQa3DEligibility();
    if (ineligible) throw new Error(ineligible);
    const leftHand = uiStore.axisConvention3D === 'leftHand';
    const includeSelfWeight = uiStore.includeSelfWeight;
    const input = modelStore.buildSolverInput3D(includeSelfWeight, leftHand);
    if (!input) throw new Error('Could not build the 3D FEM input from current model.');

    // Serialize ONCE to freeze exactly the submitted native model.
    const json = serializeInput3D(input);
    if (json.length > 32 * 1024 * 1024) {
      throw new Error('Native QA input exceeds the 32 MiB input limit.');
    }
    const revision = currentModelRevision();
    // Any unsupported modification occurring while native FEM runs
    // invalidates the response; never attempt a silent WASM fallback.
    const getRevision = (): string => {
      try { return currentModelRevision(); }
      catch { return 'invalidated-' + String(Date.now()); }
    };
    runId = desktopQaMonitor.beginNativeQa(input.nodes.size, input.elements.size, includeSelfWeight);
    start = performance.now();
    const result = await nativeExecutionManager.submit(revision, getRevision, async () => {
      const result = await nativeSolve3DJson(json);
      validateNative3DResult(input, result);
      return result;
    });
    // Additional guard at the presentation boundary. A superseding
    // model/route update must not allow old data to be displayed.
    if (getRevision() !== revision) throw new StaleNativeResultError();
    // Do not mix previous nonlinear/combination/design-check conclusions
    // into an experimental single-case Native QA display.
    resultsStore.clear3D();
    verificationStore.clear();
    resultsStore.setResults3D(result, false, 'native-qa');
    desktopQaMonitor.finishNativeQa(runId, 'complete', performance.now() - start);
    uiStore.toast(
      'Native Rust QA result (3D linear only). Verify parity before design use. ' +
        result.elementForces.length + ' members analysed.',
      'info'
    );
  } catch (error) {
    const cancelled = error instanceof StaleNativeResultError;
    if (runId != null) desktopQaMonitor.finishNativeQa(
      runId, cancelled ? 'discarded' : 'error',
      start ? performance.now() - start : undefined,
      cancelled ? 'Model changed, another solve started or result discarded.' : String(error)
    );
    if (!cancelled) uiStore.toast('Native QA: ' + String(error), 'error');
  }
}
