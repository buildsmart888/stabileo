import { describe, expect, it } from 'vitest';
import { validateNative3DResult } from '../native-qa-validation';
import type { AnalysisResults3D, SolverInput3D } from '../../engine/types-3d';

function makeInput(): SolverInput3D {
  return {
    nodes: new Map([
      [1, { id: 1, x: 0, y: 0, z: 0 }],
      [2, { id: 2, x: 3, y: 0, z: 0 }]
    ]),
    elements: new Map([[1, {
      id: 1, type: 'frame', nodeI: 1, nodeJ: 2, materialId: 1, sectionId: 1,
      releaseMyStart: false, releaseMyEnd: false, releaseMzStart: false,
      releaseMzEnd: false, releaseTStart: false, releaseTEnd: false
    }]]),
    materials: new Map([[1, { id: 1, e: 200000, nu: 0.3 }]]),
    sections: new Map([[1, { id: 1, a: 0.01, iy: 0.0001, iz: 0.0001, j: 0.00001 }]]),
    supports: new Map([[1, {
      nodeId: 1, rx: true, ry: true, rz: true, rrx: true, rry: true, rrz: true
    }]]),
    loads: []
  };
}
function makeResults(): AnalysisResults3D {
  const d = (nodeId: number) => ({ nodeId, ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 });
  return {
    displacements: [d(1), d(2)],
    reactions: [{ nodeId: 1, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 }],
    elementForces: [{
      elementId: 1, length: 3, nStart: 0, nEnd: 0, vyStart: 0, vyEnd: 0,
      vzStart: 0, vzEnd: 0, mxStart: 0, mxEnd: 0, myStart: 0, myEnd: 0,
      mzStart: 0, mzEnd: 0
    }] as unknown as AnalysisResults3D['elementForces']
  };
}
describe('Phase 1E 3D Native QA result gate', () => {
  it('accepts a complete zero-load finite reference shape', () => {
    expect(() => validateNative3DResult(makeInput(), makeResults())).not.toThrow();
  });
  it('rejects dropped displacement nodes', () => {
    const result = makeResults();
    result.displacements.pop();
    expect(() => validateNative3DResult(makeInput(), result)).toThrow('node displacements');
  });
  it('rejects NaN, infinity and missing numeric values', () => {
    for (const invalid of [NaN, Infinity, undefined]) {
      const result = makeResults();
      (result.displacements[1] as any).uz = invalid;
      expect(() => validateNative3DResult(makeInput(), result)).toThrow('invalid numeric');
    }
  });
  it('rejects unknown and duplicate IDs', () => {
    const result = makeResults();
    result.displacements[1].nodeId = 1;
    expect(() => validateNative3DResult(makeInput(), result)).toThrow('duplicate');
    const other = makeResults();
    other.elementForces[0].elementId = 33;
    expect(() => validateNative3DResult(makeInput(), other)).toThrow('member force ID');
  });
  it('rejects missing forces and impossible nonpositive lengths', () => {
    const result = makeResults();
    (result.elementForces[0] as any).mxEnd = null;
    expect(() => validateNative3DResult(makeInput(), result)).toThrow('invalid numeric');
    const other = makeResults();
    other.elementForces[0].length = 0;
    expect(() => validateNative3DResult(makeInput(), other)).toThrow('length');
  });
});
