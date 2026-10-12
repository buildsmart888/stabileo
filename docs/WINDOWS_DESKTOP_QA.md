# GO Structural Analysis Desktop: Windows Acceptance & Release Gates

**Date:** 12 October 2026
**Project:** GO Structural Analysis (Stabileo / AGPL-3.0)
**Owner evidence:** Windows manual acceptance result supplied by project maintainer.
**Scope:** This records an end-user functional smoke test, **not** an independent structural-software certification.

## Accepted baseline — v0.1.1

| Windows acceptance case | Result reported |
| --- | --- |
| Install via Windows NSIS setup.exe and launch main UI | PASS |
| Open a 2D example; inspect support reactions, shear and bending moment | PASS |
| Open a 3D example; inspect deformed shape | PASS |
| Save a .ded project, reopen it, and confirm no data loss | PASS |
| Disable internet; run 2D/3D structural solver locally | PASS |
| Export Excel for 2D and 3D, inspect reactions, moments and units | PASS |
| Generate, print and save PDF calculation report; inspect result tables | PASS |
| Create Recovery snapshot, modify model, restore, and confirm prior data | PASS |

**Summary: 6/6 originally defined acceptance areas PASS**, with the combined export/recovery area including three subchecks.

The verified source baseline is preserved on branch:
`release/go-desktop-v0.1.1-accepted`.
This branch is intentionally separate from subsequent hardening. The working installer is unsigned; test and source artifacts remain covered by AGPL-3.0.

## v0.1.2 hardening — NEW acceptance cases

The following enhancements are implemented **but must be rebuilt and verified on Windows**:

1. **Recovery history:** After each structural change, wait 30s or switch window focus. Open Recovery and confirm a current snapshot plus up to four previous *distinct* versions per tab. Select an older version, inspect model changes, cancel restore, then confirm restore. Save As when recovered.
2. **Unchanged model deduplication:** Leave the same model open for two or more 30s intervals. Check that another history entry is NOT created and the status changes to “Recovery verified”. The timer alone should not create revisions.
3. **Recovery health indicator:** Confirm the toolbar displays “Recovery saved” or “Recovery verified” with a timestamp; simulated disk failures should show a visible “Recovery error” and an error in developer diagnostics. **Do not intentionally fill or damage a real work drive** to test error handling.
4. **Upgrade compatibility:** Install v0.1.2 over the accepted v0.1.1 build; the original .ded files and the current v0.1.1 Recovery snapshot should remain readable. A user-chosen archive name, source format and content must not be silently changed.
5. **Excel lazy loading:** Open the program with no Excel action and compare startup responsiveness/memory use with v0.1.1 on the same machine and example model. Then export Excel from both 2D and 3D. Confirm numeric result cells are stored as **numbers**, not strings (Excel cell formatting / ISNUMBER formula). Check reaction values against UI.
6. **Engineering regression:** The `desktop:verify-solver` gate must execute Rust/WASM benchmark analyses for 2D cantilever, **2D simply supported UDL beam** (30 + 30 kN reactions for w=10kN/m on 6m span) and 3D cantilever. Check calculated reactions, support displacements and member forces.
7. **Prior accepted functions:** Repeat installation, Windows app startup, 2D and 3D solves, .ded save/reopen, PDF, Excel and true offline solving. Do not call this release accepted until all are reverified.

### Windows build commands for v0.1.2

```powershell
cd C:\Users\g_np2\stabileo
git fetch origin
git switch --track origin/feat/go-desktop-v0.1.2-hardening
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -SkipEngineTests -SkipWasmBuild
```

`-SkipWasmBuild` is only suitable if a valid Rust/WASM engine binary is already present from the same local checkout and solver code is unchanged; the build script still executes actual WASM solver verification. **Do not skip** when building from a new checkout or after engine changes.

Expected NSIS file: `web\src-tauri\target\release\bundle\nsis\GO Structural Analysis (Stabileo Desktop)_0.1.2_x64-setup.exe`.

### Remaining production blockers

- GitHub-hosted Actions runner provisioning fails before job setup for this fork; successful local Windows build does not turn CI green.
- Windows binary and NSIS installer are **unsigned**; obtain signing credentials and verify installer integrity before external distribution.
- The baseline functional tests do not replace extensive independent FEM reference studies, load-combination verification, standards/jurisdictional design checks, units and coordinate convention review, interoperability QA or adversarial model testing.
- The original project plus these changes remain AGPL-3.0; audit third-party dependency notices and provide corresponding source when distributing.
- A reproducible npm lockfile including the current Tauri CLI dependency should be generated in a network-connected development environment and committed before requiring `npm ci` on CI.

