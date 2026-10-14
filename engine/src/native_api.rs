//! Platform-neutral structural analysis entry points.
//!
//! Keep FEM mechanics and JSON serialization here, without depending on JS,
//! WebAssembly, desktop frameworks, or I/O. The WASM wrapper in lib.rs and
//! native desktop/CLI consumers must call these same functions.
//!
//! The public types and JSON schema are intentionally the existing solver
//! contracts; no model migration is introduced by Phase 1A.

use crate::types::{AnalysisResults, AnalysisResults3D, SolverInput, SolverInput3D};

/// Solve 2D linear static analysis for an already-validated Rust model.
/// Numerical/model validation is delegated to the FEM solver itself.
pub fn solve_linear_2d(input: &SolverInput) -> Result<AnalysisResults, String> {
    crate::solver::linear::solve_2d(input)
}

/// Solve 3D linear static analysis for an already-validated Rust model.
pub fn solve_linear_3d(input: &SolverInput3D) -> Result<AnalysisResults3D, String> {
    crate::solver::linear::solve_3d(input)
}

/// JSON boundary usable by both native applications and WebAssembly.
/// Input/output use the existing solver's camelCase format.
pub fn solve_linear_2d_json(json: &str) -> Result<String, String> {
    let input: SolverInput =
        serde_json::from_str(json).map_err(|err| format!("Parse error: {err}"))?;
    let results = solve_linear_2d(&input)?;
    serde_json::to_string(&results).map_err(|err| format!("Serialize error: {err}"))
}

/// JSON boundary usable by both native applications and WebAssembly.
/// Input/output use the existing solver's camelCase format.
pub fn solve_linear_3d_json(json: &str) -> Result<String, String> {
    let input: SolverInput3D =
        serde_json::from_str(json).map_err(|err| format!("Parse error: {err}"))?;
    let results = solve_linear_3d(&input)?;
    serde_json::to_string(&results).map_err(|err| format!("Serialize error: {err}"))
}
