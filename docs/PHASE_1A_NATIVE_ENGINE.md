# Phase 1A: Shared Native and WASM Linear Solver

## Implementation

The existing FEM mechanics in engine/src/solver/linear.rs are unchanged.
The common, platform-neutral typed and JSON entry points are in
engine/src/native_api.rs. The original WASM solve_2d and solve_3d
functions now forward to them. This preserves existing web exports
and errors while native clients can invoke Rust without JS.

The native CLI in engine/src/bin/stabileo-native.rs demonstrates
the desktop execution path without building the Tauri UI.

## Native examples

From repo root:

    cargo run --release -p dedaliano-engine --bin stabileo-native -- 3d engine/tests/fixtures/cantilever-3d-input.json
    cargo run --release -p dedaliano-engine --bin stabileo-native -- 2d engine/tests/fixtures/cantilever-input.json

The executable writes one result JSON object to stdout, and errors to stderr.

## Test commands

    cargo test -p dedaliano-engine --test native_adapter_parity
    cargo check -p dedaliano-engine --bin stabileo-native
    cd engine && wasm-pack build --target web --out-dir ../web/src/lib/wasm --no-opt
    cd web && npm ci && npm run build && npm test

Phase 1A tests compare typed and JSON native calls on 2D and 3D fixtures.
Timing metadata and diagnostic text are excluded from numeric parity.
The complete WebAssembly-vs-native runtime parity test is deferred
until a shared end-to-end cross-platform test harness is available.
This is not yet a 3D professional engineering certification gate.

Future requirements: full cross-runtime numeric parity, equilibrium and
independent benchmarks, mixed frame/shell tests, performance studies
at 1k/5k/10k elements, and Tauri integration.

## License

Stabileo is AGPL-3.0. A native adapter does not change the
obligations of derivative software. Open Core and closed Professional
offerings require an appropriate licensing strategy and legal review.
