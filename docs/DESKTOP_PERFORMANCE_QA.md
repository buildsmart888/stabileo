# GO Structural Analysis Desktop v0.2.0 — 3D Performance & Engineering QA

**Branch:** `feat/go-desktop-v0.2.0-3d-performance`  
**Parent:** `feat/go-desktop-v0.1.2-hardening` (v0.1.2 itself awaits Windows acceptance).  
**Verified stable fallback:** `release/go-desktop-v0.1.1-accepted`.  
**License:** AGPL-3.0.  
**Status:** Source-level implementation and regression cases; **no v0.2.0 native Windows pass or measured FPS claimed yet**.

## What caused slow orbit/pan/zoom

The existing Three.js viewport already used one batched wireframe draw call and BVH instance picking. It had four bottlenecks:

1. Heavy-model LOD activated only at >3,000 general visuals or >1,200 section visuals, far above a representative seven-floor PRO fixture.
2. On OrbitControls `end`, expensive per-member solids, labels, overlays and high-DPI canvas were restored while the camera still ran 20 damping frames.
3. An OrbitControls `change` emitted during `renderOnce` could request another animation frame while `renderOnce` scheduled an additional frame at its tail. The new scheduler prevents duplicate pending WebGL frames.
4. Repeated unchanged model-store synchronization re-uploaded batched member positions/colors and node/member picking instance transforms to the GPU.

## Implemented improvements

- Adaptive model complexity = frame members + 2 × shells + 0.5 × load objects (screen-cost heuristic, **not FPS**).
- Automatic fast orbit centerlines for complex PRO/sections models while retaining high-detail geometry at rest.
- Quality presets in 3D viewport: **Auto** (recommended), **Fast** (always lightweight during interaction), **Detail** (retain all geometry); local visual preference, no effect on solver.
- Keep lightweight preview throughout OrbitControls damping, then restore the configured detail and idle resolution.
- High-performance GPU preference and safe idle DPR cap (Auto 1.5, Fast 1.25, Detail 2.0); temporary interaction DPR ≤1.
- FPS/Draw Calls/Triangles/Members/Frame Submit overlay, available by pressing **FPS** at bottom right.
- Throttle BVH hover raycasts to about 20 Hz for complex models.
- Skip redundant GPU buffer uploads for unchanged node coordinates, element centerlines and picking matrices.
- Preserve shell contour triangles where needed; the batched member mesh also receives engineering result colors during motion.
- Freeze animated modal/deformed geometry regeneration while orbiting heavy models. It resumes after movement.
- Cancel OrbitControls/camera timers and pending hover render on viewport teardown.
- Engineering regression gate expands to a 105-member 3D building reference, in addition to existing 2D/3D beam/frame cases.
- Unit tests cover real fixture complexity and LOD semantics. `npm run desktop:smoke` audits checked-in dataset counts.

## Actual model examples used to select automatic thresholds

| Fixture | Frame elements | Shells | Load entries | Weighted cost |
| --- | ---: | ---: | ---: | ---: |
| `pro-edificio-7p` | 203 | 77 | 196 | 455 |
| `rc-design-frame` | 408 | 0 | 656 | 736 |
| `la-bombonera` | 2,476 | 120 | 514 | 2,973 |
| `xl-diagrid-tower` | 3,434 | 0 | 21 | 3,444.5 |

These figures were read from the project's own JSON models. They are not measured frame rates.

## Building on the original Windows development machine

```powershell
cd C:\Users\g_np2\stabileo
git fetch origin
git switch --track origin/feat/go-desktop-v0.2.0-3d-performance
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -SkipEngineTests -SkipWasmBuild
```

**Only use `-SkipWasmBuild` if the existing local checkout already contains the previously verified Rust/WASM binary and the engine source is unchanged.** For a new checkout, remove the flag.

The build script performs Node reference/fixture tests, Rust/Tauri tests, real WASM benchmark analyses and generates a **version-specific** Windows x64 NSIS setup executable. Expected output:

`web\src-tauri\target\release\bundle\nsis\GO Structural Analysis (Stabileo Desktop)_0.2.0_x64-setup.exe`

For targeted extra frontend and LOD tests, after `npm install` run from `web\`:

```powershell
npx vitest run src/lib/viewport3d/__tests__/lod.test.ts src/lib/three/__tests__/elements-batched.test.ts src/lib/three/__tests__/elements-picking.test.ts src/lib/three/__tests__/nodes-instanced.test.ts
npm run desktop:performance-fixtures
npm run desktop:verify-solver
```

## Windows interactive performance acceptance (compare with v0.1.1)

Use the SAME physical Windows PC, external power plan, display resolution, browser scaling and driver for comparisons. Disable other intensive GPU applications and test while offline.

1. **Initial model display:** Open each fixture. Time from selecting the example to complete model display. Verify all nodes, shell panels, members and loads exist; record any freeze or blank frame.
2. **Orbit + zoom for 10 seconds:** Set PRO 3D viewport to `Auto`, enable **FPS**, hold left mouse button to rotate; repeat wheel zoom and pan. Record moving FPS and approximate Draw Calls, plus responsiveness after pointer release. Record screen captures in the QA ticket. This is a measured device result, not an inferred value.
3. **Preset comparison:** Repeat with `Fast` and `Detail`. During Fast/Auto motion, the heavy structure may temporarily display lightweight colored member centerlines; it must return to the full geometry after damping.
4. **Result safety:** Test `axialColor`, frame `colorMap`, `verification`, and shell `Von Mises` when available. Their colors must remain interpretable, shell triangles visible where needed, and detailed result view restored after mouse release. No solver re-run should be caused solely by changing quality preset.
5. **Selection safety:** Select nodes, supports, shells and multiple members after orbit ends. Check hover, box select and identifiers. Pan/zoom should not unexpectedly select, move, duplicate or delete anything.
6. **Smoke regression:** Retest 2D + 3D solve, `.ded` save and reopen, 2D/3D XLSX, calculation PDF, Recovery History, and completely offline solving.
7. **Numerical checks:** Verify the build gate runs actual WASM models including 2D UDL cantilever, simply supported beam (30+30 kN reactions for 10 kN/m on 6 m), 3D cantilever and the larger 105-member building case. Compare reactions and displacements with the repository's engine fixtures.
8. **Risk:** Check very large input models (stadium/diagrid), laptop integrated graphics and high-DPI external monitors. Record rendering device/browser details when FPS remains low.

### Suggested improvement targets, not claims

- For the 7-floor PRO example, target smooth Auto-mode orbit near **30 FPS or higher** on the reference Windows PC.
- A substantial reduction in draw calls **during movement** compared to idle section mode, with engineering colors preserved.
- No dark/empty canvas after selecting, panning or box selection; no memory leak or lost members after switching from a small to a much larger model.
- No changes in structural analysis results versus v0.1.1 after solving the same models.

## Production readiness blockers (remain open)

- Third-party code signing for Windows installer and app, signed update distribution, checksums.
- GitHub-hosted Windows Actions currently fails before runner allocation on the repository; local build worked for prior releases, but cannot substitute independent CI.
- Detailed FEM verification beyond the current references: shells, staged loads, modal/buckling, geometry nonlinearity, P-Delta, load combinations (including Thai ministerial rule B.E. 2566 where applicable), independent numerical comparison, units and sign conventions.
- AGPL-3.0 source/third-party notice audit before public distribution; proprietary GO Professional remains outside this codebase pending licensing.
- A refreshed committed npm lockfile with the Tauri CLI package for reproducible `npm ci`; the current build path uses `npm install --no-package-lock`.

**Do not merge this experimental branch to a released baseline or claim numerical certification based on FPS/functional testing alone.**
