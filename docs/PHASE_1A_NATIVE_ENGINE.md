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

## End-to-end differential verification

The CI test job now builds a native CLI and a Node.js-compatible WASM artifact,
then executes scripts/verify-native-wasm-parity.cjs with six existing
2D/3D fixture models. It compares all primary displacement, reaction and
member-end force components by stable node/member ID, rather than matching
array ordering. Its floating-point tolerances are explicitly specified.

Two cantilever fixtures also have independent closed-form deflection and
reaction checks. Advanced nonlinear, shell, modal and design-check parity
are not yet covered. These gates require functioning GitHub-hosted runners.

### Diagnosing GitHub Actions infrastructure failures

GitHub run 38587718493 reported three failed jobs with no assigned runner,
zero execution steps and zero billable runner time. Historical workflow
failures predate this change. This is NOT evidence of Rust compilation
errors. Check the repository's Actions enablement, organization/plan
limits, billing/spend limits and account restrictions in GitHub Settings,
and rerun the job after runner access is restored. Do not weaken
engineering validation gates to work around missing runners.
