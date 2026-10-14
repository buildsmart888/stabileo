# Phase 1B: Tauri Native FEM Integration (QA)

Branch: feat/phase1b-tauri-native-solver
Base: feat/go-desktop-v0.2.0-3d-performance

This branch carries the Phase 1A platform-neutral adapter into the existing
GO Structural Analysis Tauri 2 Desktop shell and links the shared engine
directly through a Rust Cargo path dependency.

## What is implemented

- Tauri command: desktop_solve_linear(mode, inputJson)
- Supported modes: 2d and 3d linear static only
- Commands run on a blocking thread pool, not the main UI thread
- Native Rust data path: Tauri -> dedaliano_engine::native_api -> FEM solver
- TypeScript adapter: web/src/lib/desktop/native-solver.ts
- Existing web WASM solver remains the default production path

The Tauri frontend uses invoke("desktop_solve_linear", { mode: "3d", inputJson }).
The native API returns a JSON string in the existing result format.

## Required Windows QA

1. Verify Cargo resolves the relative engine dependency.
2. Run cargo test --manifest-path engine/Cargo.toml --test native_adapter_parity.
3. Run cargo test --manifest-path web/src-tauri/Cargo.toml.
4. Run npm run desktop:verify-solver and npm run desktop:perf-unit in web/.
5. Execute identical solver-input JSON on Native and WASM, compare by IDs:
   displacements, reactions, and all end forces within abs/relative tolerances.
6. Verify models with member releases, Z-up local axes and disconnected nodes.
7. Validate UI remains interactive while native solve is running and no results
   from stale models can overwrite the active model.
8. Run manual Windows app tests for .ded projects, recovery, Excel/PDF and offline.

## Release gate

Native mode remains opt-in / adapter-only until independent cross-runtime
parity, error diagnostics, concurrency/cancellation strategy, large 3D
performance and third-party licensing are signed off. Do not silently
fallback after a native numerical failure: surface that error to engineers.

## GitHub CI infrastructure

GitHub-hosted jobs on this fork have been failing before runner assignment.
No build/test success can be inferred from GitHub check failures. Use a local
Windows development environment to establish build and acceptance evidence.

## License

Stabileo remains AGPL-3.0. Linking its Rust crate into Desktop does not
remove copyleft obligations or authorize closed-source distribution.
