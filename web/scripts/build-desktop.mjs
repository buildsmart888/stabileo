import { spawnSync } from 'node:child_process';
const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', '--', 'vite', 'build'], {
  cwd: new URL('../', import.meta.url), stdio: 'inherit',
  env: { ...process.env, GO_DESKTOP_STRICT_WASM: '1' }
});
if (run.error) throw run.error;
process.exit(run.status ?? 1);
