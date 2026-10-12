# GO Structural Analysis Desktop (Stabileo AGPL-3.0)

Desktop source lives in `web/src-tauri/`. This remains an **unsigned test build**.

## Build directly on Windows

Install Node.js 22+, Rustup, Git, Microsoft C++ Build Tools (MSVC + Windows SDK), and WebView2 Runtime.
Check out the Desktop feature branch in Windows PowerShell:

```powershell
git clone https://github.com/buildsmart888/stabileo.git
cd stabileo
git switch feat/go-desktop-tauri-mvp-20261012
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

The script installs stable/nightly Rust toolchains and wasm-pack if needed, compiles the real
Rust/WASM solver, exercises actual 2D and 3D solver runs, tests the Tauri Rust shell, builds
the frontend and NSIS installer, and prints installer path plus SHA-256 checksum.
Requires internet to download dependencies. Signing is not configured.

## GitHub Actions runner provisioning blocker

12 October 2026 runs 38202454766 / 38202464883 and the CI Linux jobs **failed before
"Set up job"** with `runner_id=0` and empty `steps=[]`. A failed-job rerun of
38202464883 behaved identically. No Windows compilation commands were executed.

Check the repository Settings > Actions > General (runner/action allowances) and
user Settings > Billing and licensing > Actions usage and payment status.
This is a public repository, whose standard hosted runner minutes are normally free.
If GitHub still rejects all jobs before runner assignment, contact GitHub Support
and include the run IDs and no-steps evidence. The code cannot fix hosted-runner provisioning.

## Notes
- Project Open/Save/Save As commands use Tauri-hosted native dialogs.
- Periodic recovery snapshots live in the Tauri per-app local data directory.
- Existing project deserializer validates loaded `.ded` models; saved files get a `.ded.bak`.
- Ctrl+O / Ctrl+S / Ctrl+Shift+S are available in the desktop UI.
- Offline calculations use local WASM. AI provider features require internet and external services.
- Existing engine smoke tests compare reference fixtures; `desktop:verify-solver` separately
  **runs actual** Rust WASM linear-static 2D and 3D example solves.
- WASM gate is mandatory before NSIS is allowed to build. No stub binaries accepted.
- Windows UI, installer execution, model import/export, print and complete offline tests
  still require Windows acceptance. A green CI doesn't certify structural results.
- Keep AGPL-3.0 `LICENSE` and `NOTICE-AGPL.txt` when distributing.
