# Phase 1C — Numerical Parity and Performance Acceptance

Branch: feat/phase1c-numerical-performance-qa
Base: feat/phase1b-tauri-native-solver

## Added evidence gates

1. Tauri unit tests call the **actual in-process** native Rust 2D/3D
   command logic using existing reference fixtures, and check malformed
   inputs, invalid solver modes and the input-size limit.
2. Windows CI builds a real release-mode native CLI.
3. Windows CI builds real WASM glue for Node and compares native and WASM
   computations on 6 shared 2D/3D fixtures via
   scripts/verify-native-wasm-parity.cjs. Displacements, reactions and
   member end forces are matched by stable node/element IDs. Tolerances
   are absolute/relative and include finite-result checks.
4. Independent closed-form deflection and reaction checks on cantilevers.
5. A repeatable native CLI benchmark records JSON evidence with
   model sizes and timings for 3 smaller fixtures, as an informational
   report. This measures process startup, I/O, JSON handling and solve
   **combined**, not just solver time, and does not measure memory.
6. Windows CI archives benchmark evidence. Failure to provision a GitHub
   runner does **not** imply engineering acceptance.

## Run on Windows

    cargo +stable test --manifest-path engine/Cargo.toml --test native_adapter_parity
    cargo +stable test --manifest-path web/src-tauri/Cargo.toml
    cargo +stable build --release -p dedaliano-engine --bin stabileo-native
    cargo +stable install wasm-pack --locked
    cd engine
    wasm-pack build --target nodejs --out-dir ../target/wasm-parity --no-opt
    cd ..
    set GO_PERF_RUNS=5
    set STABILEO_NATIVE_BIN=target\release\stabileo-native.exe
    node scripts/verify-native-wasm-parity.cjs
    node scripts/benchmark-native-solver.cjs

These examples assume CMD syntax; in PowerShell, set variables using
$env:GO_PERF_RUNS="5" and $env:STABILEO_NATIVE_BIN="target\release\stabileo-native.exe".

## Manual Windows acceptance (not automated yet)

- Spin/orbit a 3D model while issuing an opt-in native solve.
- Confirm pointer interactions remain responsive, measure p50/p95 frame
  times, FPS and memory before/during/after solving.
- Repeat solves after edits; results from stale input revisions must not
  overwrite current-model results. A cancellation/versioned-request policy
  must be designed before routing production UI solves to Native.
- Exercise nonlinear, advanced loads, shells, member releases and mixed
  models separately: these are **not** covered by the initial 6-fixture
  linear differential gate.
- Use at least two hardware profiles, record CPU/RAM/OS/Rust version.
- For the 1k, 5k and 10k member targets, create validated stable models
  with published dimensions, boundary conditions and expected invariants
  before trusting or publishing numbers. Never claim those results from
  the 105-member fixture.
- Check error presentation, saved projects, recovery, PDF/Excel and
  offline behavior.

## Release blockers

No production Native-default switchover until automated gates pass,
large-model tests complete, UI responsiveness and stale-response handling
are verified, and an AGPL/open-core licensing plan is approved.
This pull request stays Draft pending actual CI/local Windows evidence.
