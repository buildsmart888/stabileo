/**
 * Runtime gate: actually instantiate the compiled Rust/WASM engine and run
 * independent 2D + 3D reference models, not just inspect WASM magic bytes.
 * Native structural analysis must not be shipped with a dummy glue module.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const generated = resolve(import.meta.dirname, '../src/lib/wasm');
const glue = await import(pathToFileURL(join(generated, 'dedaliano_engine.js')).href);
const wasm = await readFile(join(generated, 'dedaliano_engine_bg.wasm'));
assert.equal(typeof glue.initSync, 'function', 'Missing WASM synchronous initializer');
assert.equal(typeof glue.solve_2d, 'function', 'Missing Rust 2D solver binding');
assert.equal(typeof glue.solve_3d, 'function', 'Missing Rust 3D solver binding');
glue.initSync({ module: new WebAssembly.Module(wasm) });
const fixtures = resolve(import.meta.dirname, '../../engine/tests/fixtures');
const fixture = async (name) => JSON.parse(await readFile(join(fixtures, name), 'utf8'));
const close = (label, value, reference, abs = 1e-6, rel = 1e-6) => {
  assert.ok(Number.isFinite(value), label + ': value is not finite');
  assert.ok(Math.abs(value - reference) <= abs + rel * Math.abs(reference),
    label + ': actual=' + value + ', expected=' + reference);
};
const byNode = (items, id) => {
  const item = items.find((r) => r.nodeId === id);
  assert.ok(item, 'Missing node ' + id);
  return item;
};

// 2D: UDL cantilever, q=-10 kN/m, L=5 m, E=200000 MPa, Iz=1e-4 m4.
const input2 = await fixture('ex-cantilever-input.json');
const output2 = JSON.parse(glue.solve_2d(JSON.stringify(input2)));
const react2 = byNode(output2.reactions, 1);
const tip2 = byNode(output2.displacements, 2);
const force2 = output2.elementForces.find((x) => x.elementId === 1);
assert.ok(force2);
close('2D vertical reaction', react2.rz ?? react2.ry, 50);
close('2D fixed-end moment', react2.my ?? react2.mz, 125);
close('2D tip displacement', tip2.uz ?? tip2.uy, -0.0390625, 1e-5);
close('2D shear at support', force2.vStart, 50);

// 3D: cantilever 6m, loads Fy=-10kN and Fz=-5kN.
const input3 = await fixture('cantilever-3d-input.json');
const output3 = JSON.parse(glue.solve_3d(JSON.stringify(input3)));
const react3 = byNode(output3.reactions, 1);
const tip3 = byNode(output3.displacements, 2);
close('3D Fy reaction', react3.fy, 10);
close('3D Fz reaction', react3.fz, 5);
close('3D fixed-end My', react3.my, -30);
close('3D fixed-end Mz', react3.mz, 60);
close('3D tip Uy', tip3.uy, -0.036, 1e-5);
close('3D tip Uz', tip3.uz, -0.018, 1e-5);
console.log('PASS: compiled Rust/WASM solved 2D and 3D benchmark models with reference parity.');
