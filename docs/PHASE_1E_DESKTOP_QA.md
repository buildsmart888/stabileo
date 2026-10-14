# Phase 1E — Desktop Professional Native QA (Experimental)

Base branch: feat/phase1d-native-execution-manager
Feature branch: feat/phase1e-desktop-native-qa

## Deliverables

- **Native QA Solve 3D** is an explicit button on the existing Tauri
  Desktop toolbar. It takes the CURRENT model from modelStore, builds
  an immutable Rust solver JSON input, performs the actual native 3D
  **linear static** analysis, and updates the existing 3D results store
  only after the run is current and numeric output passes structural checks.
- Existing Solve/Calcular and Live Calc still use the original WASM path.
  Native is NOT the default and there is NO automatic fallback after failure.
- During an in-flight native job, any model mutation invalidates its
  outcome. The full model snapshot, active tab, analysis mode and
  self-weight/axis options are checked again before publishing output.
- Existing Phase 1D latest-request-wins queue and safe result discard are
  used; the Rust thread itself is NOT force-cancelled.
- QA eligibility intentionally excludes load combinations, multiple load
  cases, live calculation, shells/plates, extra constraints/connectors,
  member offsets and joint expansions. This is NOT parity for all PRO
  model features. Users must continue to use the standard solver there.
- **Unverified output provenance:** Native QA results are labeled
  `native-qa` and display a persistent UNVERIFIED warning. The desktop
  PDF/Excel buttons, the PDF calculation dialog, CSV download and
  direct Excel export reject this source; switching back to standard
  WASM Solve replaces it with the normal `wasm` provenance.
  Prior design verification and advanced results are cleared before
  publishing QA data. A separate telemetry-only JSON export remains available.
- Pure numerical sanity checks verify finite 3D displacements, reactions,
  member-end forces, valid node/member IDs, expected row counts and
  positive member lengths. These do not replace independent FEM validation.
- An on-screen **QA Metrics** panel shows:
  1. UI requestAnimationFrame tick rate and p95 frame interval;
  2. Tauri Rust host process CPU percentage and resident memory;
  3. Recent native end-to-end call times and disposition in exported JSON.
  The host CPU may exceed 100% when several cores are used. The native
  memory metric excludes WebView2 renderer/GPU child processes.
- **Export QA Evidence (.json)** uses the user-selected file dialog,
  validates structured JSON on the Rust side and stores recent bounded
  samples (max 1800) and summaries of the latest 100 QA runs. It exports
  NO structural model geometry, member data or load values.

## Windows build and test

Use a local Windows console with MSVC Build Tools, Windows SDK,
Node 22, Rust, wasm-pack and Tauri prerequisites. From the repo:

    git fetch origin
    git switch --track origin/feat/phase1e-desktop-native-qa
    cargo +stable test --manifest-path engine/Cargo.toml --test native_adapter_parity
    cd web
    npm install --no-package-lock
    npm run desktop:native-qa
    npm run desktop:perf-unit
    cargo +stable test --manifest-path src-tauri/Cargo.toml
    cd ..
    powershell -ExecutionPolicy Bypass -File .\build-windows.ps1

NOTE: Do NOT use SkipWasmBuild when Rust engine sources changed.
Build a fresh real WASM binary; a stale WASM artifact invalidates parity.

## Manual acceptance matrix

| Case | Expected outcome |
|------|------------------|
| Simple 3D cantilever, no combinations | Native QA Solve returns bounded finite results and displays them |
| 3D model with load combinations | Clearly blocked; standard WASM Solve available |
| PRO model with shell, connector or offset | Clearly blocked; no unsupported native presentation |
| Live Calc ON | Native QA blocked to prevent racing results |
| Edit coordinates, material, support or load during solve | Old native result discarded; edited model's store untouched |
| Switch tabs or analysis mode during solve | Old native result discarded |
| Trigger another native QA while one runs | Previous result invalidated; only latest request applied |
| Press Discard Native Result | Result invalidated; UI responsive; Rust thread may continue |
| Rust solver reports singular structure | Error displayed, no silent fallback or fabricated data |
| Native returns missing member, NaN, null or Infinity | Result rejected before resultsStore update |
| Orbit/zoom camera during native solve | No UI blocking from Tauri invoke, measure actual FPS separately |
| Export QA JSON | File dialog, valid JSON; host CPU/RAM and UI rAF clearly identified |
| After Native QA, attempt engineering PDF/Excel/CSV | Blocked with persistent UNVERIFIED label |
| Run normal WASM Solve again | QA provenance replaced with standard solver provenance; exports become available |
| Web app | Native buttons/telemetry absent; existing Web WASM path unchanged |

Record OS, CPU model, RAM capacity, test model dimensions and load units.
For UI performance, enable existing real Viewport3D FPS/draw-call HUD and
record actual camera-orbit FPS. UI rAF frequency is NOT the 3D draw rate.
For process-wide RAM, Windows Task Manager or Process Explorer should be
used to account for WebView2 children as well as the Rust host.

## Release blockers

- CI and Windows installer build/test must pass on actual runner or local
  Windows environment (GitHub Actions runner allocation has failed in
  previous runs; zero runner steps are not a Rust test result).
- Recompute independent statics/FEM reference results and actual Native
  vs WASM numerical parity on all supported model families.
- Execute 1k, 5k and 10k member benchmark scenarios on recorded hardware,
  with stress, memory and UI orbit evidence. They are not completed here.
- Multi-window OS-global scheduling, solver preemption, timeouts and
  crash isolation are still open safety/performance issues.
- Review AGPL-3.0 rights before any closed-source Open Core / Professional
  distribution.

This branch remains QA-only and should NOT be merged to main or shipped
as a verified Professional engineering solver until sign-off.
