import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Fixture structural complexity audit, not a GPU FPS benchmark.
 * Use the real in-app HUD to record FPS/draw calls on each Windows device.
 */
const cases = [
  { name: 'pro-edificio-7p', elements: 203, shells: 77, loads: 196 },
  { name: 'rc-design-frame', elements: 408, shells: 0, loads: 656 },
  { name: 'la-bombonera', elements: 2476, shells: 120, loads: 514 },
  { name: 'xl-diagrid-tower', elements: 3434, shells: 0, loads: 21 },
];
let allOk = true;
for (const sample of cases) {
  const input = JSON.parse(await readFile(
    new URL('../src/lib/templates/fixtures/' + sample.name + '.json', import.meta.url), 'utf8'
  ));
  const size = (x) => Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0;
  const measured = {
    elements: size(input.elements),
    shells: size(input.plates) + size(input.quads),
    loads: size(input.loads),
  };
  const weightedCost = measured.elements + 2 * measured.shells + 0.5 * measured.loads;
  const ok = Object.keys(measured).every((key) => measured[key] === sample[key]);
  allOk &&= ok;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + sample.name
    + ': ' + measured.elements + ' members, ' + measured.shells
    + ' shells, ' + measured.loads + ' loads, weighted visual cost=' + weightedCost);
}
assert.ok(allOk, 'Professional 3D performance fixtures changed: revisit LOD policy/benchmarks.');
console.log('Note: these are dataset counts, not measured rendering performance.');
