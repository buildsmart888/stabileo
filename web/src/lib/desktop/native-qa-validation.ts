/**
 * Read-only numerical sanity gate for opt-in QA output. This is NOT a substitute
 * for independent equilibrium, code-combination, or Native/WASM parity checks.
 */
import type { SolverInput3D, AnalysisResults3D } from '../engine/types-3d';

function finite(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Native QA invalid numeric result: ' + label);
  }
}
export function validateNative3DResult(
  input: SolverInput3D, result: AnalysisResults3D
): void {
  if (!result || !Array.isArray(result.displacements) ||
      !Array.isArray(result.reactions) || !Array.isArray(result.elementForces)) {
    throw new Error('Native QA returned an incomplete 3D result structure');
  }
  if (result.displacements.length !== input.nodes.size) {
    throw new Error('Native QA missing or extra node displacements');
  }
  if (result.elementForces.length !== input.elements.size) {
    throw new Error('Native QA missing or extra element forces');
  }
  const foundNodes = new Set<number>();
  for (const row of result.displacements) {
    if (!Number.isSafeInteger(row.nodeId) || !input.nodes.has(row.nodeId) || foundNodes.has(row.nodeId)) {
      throw new Error('Native QA duplicate or unknown displacement node');
    }
    foundNodes.add(row.nodeId);
    for (const axis of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const) {
      finite(row[axis], 'node ' + row.nodeId + ' / ' + axis);
    }
  }
  for (const row of result.reactions) {
    if (!Number.isSafeInteger(row.nodeId) || !input.nodes.has(row.nodeId)) {
      throw new Error('Native QA unknown reaction node');
    }
    for (const axis of ['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const) {
      finite(row[axis], 'reaction ' + row.nodeId + ' / ' + axis);
    }
  }
  const foundMembers = new Set<number>();
  for (const row of result.elementForces) {
    if (!Number.isSafeInteger(row.elementId) || !input.elements.has(row.elementId) || foundMembers.has(row.elementId)) {
      throw new Error('Native QA duplicate or unknown member force ID');
    }
    foundMembers.add(row.elementId);
    finite(row.length, 'member ' + row.elementId + ' length');
    if (row.length <= 0) throw new Error('Native QA member length must be positive');
    for (const key of [
      'nStart', 'nEnd', 'vyStart', 'vyEnd', 'vzStart', 'vzEnd',
      'mxStart', 'mxEnd', 'myStart', 'myEnd', 'mzStart', 'mzEnd'
    ] as const) {
      finite(row[key], 'member ' + row.elementId + ' / ' + key);
    }
  }
}
