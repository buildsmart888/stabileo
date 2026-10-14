import { afterEach, describe, expect, it } from 'vitest';
import { resultsStore } from '../../store/results.svelte';
import type { AnalysisResults3D } from '../../engine/types-3d';

const empty3D = (): AnalysisResults3D => ({
  displacements: [], reactions: [], elementForces: []
});

afterEach(() => resultsStore.clear3D());

describe('Phase 1E Native QA output provenance', () => {
  it('retains explicit unverified label until cleared or replaced by standard solver', () => {
    resultsStore.setResults3D(empty3D(), false, 'native-qa');
    expect(resultsStore.resultsOrigin3D).toBe('native-qa');
    resultsStore.setResults3D(empty3D());
    expect(resultsStore.resultsOrigin3D).toBe('wasm');
    resultsStore.setResults3D(empty3D(), false, 'native-qa');
    resultsStore.clear3D();
    expect(resultsStore.resultsOrigin3D).toBeNull();
  });
  it('clears source when model mutation clears the results store', () => {
    resultsStore.setResults3D(empty3D(), false, 'native-qa');
    resultsStore.clear();
    expect(resultsStore.resultsOrigin3D).toBeNull();
    expect(resultsStore.results3D).toBeNull();
  });
});
