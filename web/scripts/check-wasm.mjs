import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = join(import.meta.dirname, '..', 'src', 'lib', 'wasm');
const js = join(base, 'dedaliano_engine.js');
const wasm = join(base, 'dedaliano_engine_bg.wasm');
const info = await Promise.all([stat(js), stat(wasm)]).catch(() => null);
if (!info || info.some(f => f.size < 1000)) {
  console.error('FAIL: real Rust/WASM artifacts missing; run npm run wasm first. Refusing a stub solver installer.');
  process.exit(1);
}
const head = await readFile(wasm);
if (head[0] !== 0 || head[1] !== 97 || head[2] !== 115 || head[3] !== 109) {
  console.error('FAIL: the WASM binary has an invalid signature.');
  process.exit(1);
}
const glue = await readFile(js, 'utf8');
if (!glue.includes('solve_2d') || !glue.includes('solve_3d')) {
  console.error('FAIL: WASM glue does not expose both structural solvers.');
  process.exit(1);
}
console.log('PASS: real solver binary and 2D/3D bindings are present.');
