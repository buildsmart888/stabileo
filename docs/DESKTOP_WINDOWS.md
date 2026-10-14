# GO Structural Analysis Desktop (Stabileo AGPL-3.0)

## Fix for "link.exe not found" on Windows

Rustup and VS Code **do not** supply the Microsoft MSVC linker. Install
**Visual Studio Build Tools 2022** with the **Desktop development with C++**
workload, including **MSVC v143 x64/x86** and a **Windows 10/11 SDK**.

In PowerShell (installation can ask for administrator confirmation):

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --override "--passive --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

If Build Tools is already installed without the C++ workload, use
**Visual Studio Installer > Modify** and add **Desktop development with C++**.
Reopen PowerShell after installation.

The `build-windows.ps1` script now verifies the MSVC component with Microsoft's
`vswhere.exe`, imports `VsDevCmd.bat` to set `PATH`, `LIB`, `INCLUDE`
for MSVC/Windows SDK, and fails early with a clear remedy if the linker is absent.

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


## Local Windows acceptance status (12 October 2026)

Desktop **v0.1.0**: user-confirmed successful NSIS x64 installer build, local installation and startup, 2D reactions/shear/moment, 3D deformed shape, native .ded save/load round-trip and offline solving. This confirms five out of six initial acceptance areas. The sixth area (PDF, Excel and Recovery) had not yet been verified.

Desktop **v0.1.1** (this branch) adds native Excel Save As, a print-targeted report preview and a timestamped recovery list. The new features are **code-complete but await a fresh Windows rebuild and interactive retest**. This is not a certified engineering release.

## v0.1.1 export and recovery QA

1. Update the Desktop branch and build using: `powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -SkipEngineTests -SkipWasmBuild` if the v0.1.0 WASM engine is already built on the same checkout and the engine source has not changed; otherwise omit `-SkipWasmBuild`. The script still runs actual WASM verification even when rebuilding is skipped. Install the freshly created **0.1.1** NSIS executable; do not retest with the older 0.1.0 app.
2. **Excel**: Open a 2D example, solve, click **Excel** in the desktop top toolbar (or Project > Export / Import > Excel in Basic mode); use the Windows Save dialog to write an `.xlsx`. Open in Excel/LibreOffice and verify populated *Summary, Elements, Nodes, Reactions, Materials, Sections* worksheets, no `#NAME?` / `NaN` / `undefined`, correct units and spot-check support reactions against the on-screen solver results. Note that 'Support reaction totals' is intentionally **not** presented as a full equilibrium residual: applied loads also matter. Repeat using a 3D model and inspect `Fx,Fy,Fz,Mx,My,Mz`, displacement and internal-force columns. Cancel the dialog and verify no file is created.
3. **PDF**: After solving 2D and 3D samples, click **PDF Report** in the desktop top toolbar (or Project > PDF in Basic mode), enter the report metadata, and click Generate. The desktop preview should open **inside the app** (not in an external browser window). Click **Print / Save as PDF**, select **Microsoft Print to PDF** or the Windows equivalent, choose a destination, then verify PDF pages, diagrams/tables where supported, headings, units, reaction totals, page breaks and absence of cropped text. This uses the Windows print dialog; the app does not directly generate PDF bytes. If printing is unavailable, use **Save HTML** and print the saved report from a browser. The output must still be reviewed for engineering correctness.
4. **Recovery**: Open a working structure, make a change, wait at least 30 seconds, click the desktop toolbar's **Recovery**. A timestamped entry with the model name should appear. Change the model again, click Restore, cancel the confirmation, and verify no change. Click Restore again and confirm; the saved snapshot should load into the current tab. Use **Save As** to retain the recovered version. Restart the application and confirm entries remain visible. Recovery saves the active tab periodically, not all tabs at once.
5. **Regression**: Recheck previously passing features: Windows startup, 2D/3D solve, .ded open/save round trip, true offline solving. Test on representative engineering models and independently check loads, reactions, deformations, and unit conventions before design use.

Reminder: `npm run desktop:smoke` checks Rust fixture reference values and XLSX serialization.
`npm run desktop:verify-solver` executes actual WASM Rust 2D/3D analyses.

## Verified 6/6 baseline and next version

The completed v0.1.1 acceptance evidence and v0.1.2 QA procedure are documented in [WINDOWS_DESKTOP_QA.md](WINDOWS_DESKTOP_QA.md). Existing v0.1.1 binaries are not replaced by modifying the accepted source branch.

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
