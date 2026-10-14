# Phase 1D — Native Execution Manager (QA only)

Implementation: web/src/lib/desktop/native-execution-manager.ts
Adapter: web/src/lib/desktop/native-solver.ts
Tests: web/src/lib/desktop/__tests__/native-execution-manager.test.ts
Desktop UI: web/src/components/desktop/DesktopBar.svelte

The queue permits exactly one in-flight native invocation per renderer.
A newly submitted job supersedes a running result, replaces the previous
queued request and starts only after the earlier native call has settled.
The active Rust calculation is **not forcibly cancelled**. Cancel means
"discard its result", never "interrupt FEM". No fake percent-progress is
shown. Start/end/error state is observable, and the UI displays a real
completion time (wall clock, not solver-only).

The caller must supply a revision fingerprint and currentRevision callback;
recompute the revision on EVERY model mutation and tab change. Reject any
completed solve with a stale revision or superseded request ID before
updating reactive results. Keep the known-good WebAssembly path as default:
the queued native adapter is opt-in for QA, not a production switchover.

Important limits: the coordinator is renderer-local; concurrent Tauri
windows are not globally serialized. A crashed/stuck Rust solver cannot
be interrupted safely in-process. A future isolated worker process with
explicit resource budgets may be required. This stage does not add true
numeric solver progress, RAM caps, preemption or engine-level cancellation.
No claim is made that 3D frame rates improved; no 1k/5k/10k-member benchmarks
have run. Prior native/WASM parity and Windows UI acceptance remain blockers.

Run:
  cd web
  npx vitest run src/lib/desktop/__tests__/native-execution-manager.test.ts
  npm run build

Verify that a model change during a slow solve cannot display old results,
and test cancellation, delayed error responses, 3D orbit and window close.
Check GitHub Actions runner access before claiming CI pass.

AGPL-3.0 obligations remain unchanged. Do not merge into main or publish
Professional closed-source binaries without resolving source rights.
