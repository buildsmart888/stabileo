import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = new URL('../../engine/tests/fixtures/', import.meta.url);
test('2D cantilever reference equilibrium and tip displacement', async () => {
 const input = JSON.parse(await readFile(new URL('ex-cantilever-input.json',base)));
 const output = JSON.parse(await readFile(new URL('ex-cantilever-results.json',base)));
 const w=10,L=5,E=200000*1000,Iz=1e-4;
 assert.equal(input.elements['1'].type,'frame');
 assert.ok(Math.abs(output.reactions[0].ry-w*L)<1e-8);
 assert.ok(Math.abs(output.reactions[0].mz-w*L*L/2)<1e-8);
 const tip=w*L**4/(8*E*Iz);
 assert.ok(Math.abs(Math.abs(output.displacements[1].uy)-tip)<1e-8);
});
test('3D cantilever equilibrium on two lateral axes', async () => {
 const result=JSON.parse(await readFile(new URL('cantilever-3d-results.json',base)));
 const r=result.reactions[0];
 assert.ok(Math.abs(r.fy-10)<1e-8);
 assert.ok(Math.abs(r.fz-5)<1e-8);
 assert.ok(Math.abs(r.my+30)<1e-8);
 assert.ok(Math.abs(r.mz-60)<1e-8);
 assert.ok(Math.abs(result.displacements[1].uy+0.036)<1e-8);
 assert.ok(Math.abs(result.displacements[1].uz+0.018)<1e-8);
});
test('reference fixtures contain finite numbers', async () => {
 for (const name of ['ex-cantilever-results.json','cantilever-3d-results.json']) {
  const raw=await readFile(new URL(name,base),'utf8');
  assert.ok(!raw.includes('NaN')&&!raw.includes('Infinity'));
 }
});
