'use strict';
// Phase 1A: native Rust executable vs real wasm-bindgen Node.js artifact.
// Requires:
// cargo build -p dedaliano-engine --bin stabileo-native
// (cd engine && wasm-pack build --target nodejs --out-dir ../target/wasm-parity --no-opt)
// node scripts/verify-native-wasm-parity.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const wasmFile = path.join(root, 'target/wasm-parity/dedaliano_engine.js');
const nativeFile = process.env.STABILEO_NATIVE_BIN ||
  path.join(root, 'target/debug', 'stabileo-native' + (process.platform === 'win32' ? '.exe' : ''));
assert.ok(fs.existsSync(wasmFile), 'Missing built WASM module: ' + wasmFile);
assert.ok(fs.existsSync(nativeFile), 'Missing native solver CLI: ' + nativeFile);
const wasm = require(wasmFile);

const fixtures = [
  ['2d', 'cantilever-input.json'],
  ['2d', 'ex-portal-frame-input.json'],
  ['3d', 'cantilever-3d-input.json'],
  ['3d', 'ex-3d-portal-frame-input.json'],
  ['3d', 'ex-3d-space-truss-input.json'],
  ['3d', 'ex-3d-building-case1-input.json']
];
const metrics = {
  '2d': {
    displacements: ['ux', 'uz', 'ry'],
    reactions: ['rx', 'rz', 'my'],
    elementForces: ['nStart', 'nEnd', 'vStart', 'vEnd', 'mStart', 'mEnd']
  },
  '3d': {
    displacements: ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'],
    reactions: ['fx', 'fy', 'fz', 'mx', 'my', 'mz'],
    elementForces: ['nStart', 'nEnd', 'vyStart', 'vyEnd', 'vzStart', 'vzEnd',
                    'mxStart', 'mxEnd', 'myStart', 'myEnd', 'mzStart', 'mzEnd']
  }
};
const keys = { displacements: 'nodeId', reactions: 'nodeId', elementForces: 'elementId' };
const tolerance = {
  displacements: [1e-10, 1e-8],
  reactions: [1e-7, 1e-8],
  elementForces: [1e-7, 1e-8]
};
function near(a, b, label, absolute, relative) {
  assert.equal(typeof a, 'number', label + ': native value missing');
  assert.equal(typeof b, 'number', label + ': expected/WASM value missing');
  assert.ok(Number.isFinite(a) && Number.isFinite(b), label + ': nonfinite');
  const allowed = absolute + relative * Math.max(Math.abs(a), Math.abs(b));
  assert.ok(Math.abs(a - b) <= allowed,
    label + ': got ' + a + ', expected ' + b + ', tolerance ' + allowed);
}
function rowAt(result, group, id) {
  const row = result[group].find(item => item[keys[group]] === id);
  assert.ok(row, 'Missing ' + group + ' row with ID ' + id);
  return row;
}
function compare(nativeResult, wasmResult, dim, fixture) {
  for (const [group, names] of Object.entries(metrics[dim])) {
    const a = nativeResult[group], b = wasmResult[group];
    assert.ok(Array.isArray(a) && Array.isArray(b), fixture + ': missing ' + group);
    assert.equal(a.length, b.length, fixture + ': row count ' + group);
    const map = new Map(b.map(item => [item[keys[group]], item]));
    assert.equal(map.size, b.length, fixture + ': duplicate ' + group + ' IDs');
    for (const row of a) {
      const match = map.get(row[keys[group]]);
      assert.ok(match, fixture + ': missing WASM ID ' + row[keys[group]]);
      for (const key of names) {
        near(row[key], match[key], fixture + '.' + group + '.' + row[keys[group]] + '.' + key,
          ...tolerance[group]);
      }
    }
  }
}
function cantileverOracle(result, dim) {
  const modulus = 200000 * 1000; // E in MPa -> kN/m^2; L in m and load in kN.
  const inertia = 0.0001;
  if (dim === '2d') {
    near(rowAt(result, 'displacements', 2).uz,
      -50 * Math.pow(4, 3) / (3 * modulus * inertia), '2D PL^3/(3EI)', 1e-9, 1e-7);
    near(rowAt(result, 'reactions', 1).rz, 50, '2D fixed reaction', 1e-7, 1e-7);
  } else {
    const d = rowAt(result, 'displacements', 2);
    const r = rowAt(result, 'reactions', 1);
    near(d.uy, -10 * Math.pow(6, 3) / (3 * modulus * inertia), '3D UY', 1e-9, 1e-7);
    near(d.uz, -5 * Math.pow(6, 3) / (3 * modulus * inertia), '3D UZ', 1e-9, 1e-7);
    near(r.fy, 10, '3D FY', 1e-7, 1e-7);
    near(r.fz, 5, '3D FZ', 1e-7, 1e-7);
    near(r.my, -30, '3D MY', 1e-7, 1e-7);
    near(r.mz, 60, '3D MZ', 1e-7, 1e-7);
  }
}
for (const [dim, fixture] of fixtures) {
  const modelPath = path.join(root, 'engine/tests/fixtures', fixture);
  const json = fs.readFileSync(modelPath, 'utf8');
  const native = spawnSync(nativeFile, [dim, modelPath], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  });
  if (native.error) throw native.error;
  assert.equal(native.status, 0, fixture + ': CLI failed: ' + native.stderr);
  const nativeResult = JSON.parse(native.stdout);
  const wasmResult = JSON.parse(dim === '2d' ? wasm.solve_2d(json) : wasm.solve_3d(json));
  compare(nativeResult, wasmResult, dim, fixture);
  if (fixture.startsWith('cantilever')) {
    cantileverOracle(nativeResult, dim);
    cantileverOracle(wasmResult, dim);
  }
  process.stdout.write('PASS ' + dim + ' ' + fixture + '\n');
}
process.stdout.write('PASS ' + fixtures.length + ' native vs WASM cases.\n');
