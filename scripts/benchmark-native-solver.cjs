'use strict';
// Phase 1C native-only performance evidence. Not a speedup claim.
// Run: cargo build --release --bin stabileo-native
//      node scripts/benchmark-native-solver.cjs
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const bin = process.env.STABILEO_NATIVE_BIN || path.join(root, 'target/release',
  'stabileo-native' + (process.platform === 'win32' ? '.exe' : ''));
const iterations = Number(process.env.GO_PERF_RUNS ?? '3');
assert.ok(Number.isInteger(iterations) && iterations >= 1 && iterations <= 20);
assert.ok(fs.existsSync(bin), 'Native release binary missing: ' + bin);
const cases = [
  { label: '3D cantilever', file: 'cantilever-3d-input.json' },
  { label: '3D portal frame', file: 'ex-3d-portal-frame-input.json' },
  { label: '3D building', file: 'ex-3d-building-case1-input.json' }
];
const results = [];
for (const test of cases) {
  const file = path.join(root, 'engine/tests/fixtures', test.file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const times = [];
  let last = null;
  for (let i = 0; i < iterations; ++i) {
    const start = process.hrtime.bigint();
    const run = spawnSync(bin, ['3d', file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    if (run.error) throw run.error;
    assert.equal(run.status, 0, run.stderr || 'Native CLI error');
    last = JSON.parse(run.stdout);
    assert.ok(Array.isArray(last.displacements) && Array.isArray(last.reactions));
    times.push(elapsed);
  }
  const sorted = [...times].sort((a, b) => a - b);
  results.push({
    model: test.label, fixture: test.file,
    nodes: Object.keys(data.nodes).length, members: Object.keys(data.elements).length,
    repetitions: iterations, elapsedMs: times,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    minMs: sorted[0], maxMs: sorted[sorted.length - 1],
    note: 'Process startup + file I/O + JSON parsing + solve + serialization; NOT solver-only latency'
  });
}
const report = {
  schemaVersion: 1, recordedAt: new Date().toISOString(),
  platform: process.platform, arch: process.arch, node: process.version,
  binary: bin, suite: results,
  limitations: ['No WASM performance comparison', 'No peak native memory measurement',
    'No 1k/5k/10k-member performance claim', 'No Windows UI frame-time measurement']
};
const output = process.env.GO_PERF_OUTPUT || path.join(root, 'target', 'phase1c-native-perf.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, suite: results.map(({model, nodes, members, medianMs}) => ({model,nodes,members,medianMs})) }, null, 2));
