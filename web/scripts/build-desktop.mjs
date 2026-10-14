import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use Node.js directly to launch the Vite CLI, not npm.cmd.
// spawnSync('npm.cmd', ...) fails with EINVAL on Windows + Node.js 22 because
// .cmd/.bat files cannot be executed directly as child processes there.
// This also avoids npm.ps1 and the PowerShell StrictMode incompatibility.
const webDir = fileURLToPath(new URL('../', import.meta.url));
const viteCli = join(webDir, 'node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, [viteCli, 'build'], {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, GO_DESKTOP_STRICT_WASM: '1' },
});

if (result.error) {
  console.error('Failed to start Vite with Node.js:', result.error);
  process.exit(1);
}
if (result.signal) {
  console.error('Vite build terminated by signal:', result.signal);
  process.exit(1);
}
process.exit(result.status ?? 1);
