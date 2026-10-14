use dedaliano_engine::{native_api, solver::linear, types::{SolverInput, SolverInput3D}};
use serde_json::Value;

fn assert_numeric_parity(actual: &Value, expected: &Value, path: &str) {
    match (actual, expected) {
        (Value::Number(a), Value::Number(b)) => {
            let x = a.as_f64().unwrap();
            let y = b.as_f64().unwrap();
            let scale = x.abs().max(y.abs()).max(1.0);
            assert!((x-y).abs() <= scale*1e-9, "numerical mismatch at {path}: {x} != {y}");
        },
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "array length mismatch at {path}");
            for (i, (x,y)) in a.iter().zip(b.iter()).enumerate() {
                assert_numeric_parity(x,y,&format!("{path}[{i}]"));
            }
        },
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.len(),b.len(),"object length mismatch at {path}");
            for (key, value) in a {
                let other = b.get(key).unwrap_or_else(|| panic!("missing {path}.{key}"));
                assert_numeric_parity(value,other,&format!("{path}.{key}"));
            }
        },
        _ => assert_eq!(actual,expected,"mismatch at {path}"),
    }
}

fn engineering_result(mut value: Value) -> Value {
    if let Some(object) = value.as_object_mut() {
        object.remove("timings");
        object.remove("solverRunMeta");
        object.remove("solverDiagnostics");
        object.remove("structuredDiagnostics");
    }
    value
}

#[test]
fn native_2d_json_matches_typed_solver() {
    let json = include_str!("fixtures/cantilever-input.json");
    let input: SolverInput = serde_json::from_str(json).unwrap();
    let actual: Value = serde_json::from_str(&native_api::solve_linear_2d_json(json).unwrap()).unwrap();
    let expected = serde_json::to_value(linear::solve_2d(&input).unwrap()).unwrap();
    for key in ["displacements", "reactions", "elementForces"] {
        assert!(actual.get(key).is_some(), "missing {key}");
    }
    assert_numeric_parity(&engineering_result(actual),&engineering_result(expected),"2d");
}

#[test]
fn native_3d_json_matches_typed_solver() {
    let json = include_str!("fixtures/cantilever-3d-input.json");
    let input: SolverInput3D = serde_json::from_str(json).unwrap();
    let actual: Value = serde_json::from_str(&native_api::solve_linear_3d_json(json).unwrap()).unwrap();
    let expected = serde_json::to_value(linear::solve_3d(&input).unwrap()).unwrap();
    for key in ["displacements", "reactions", "elementForces"] {
        assert!(actual.get(key).is_some(), "missing {key}");
    }
    assert_numeric_parity(&engineering_result(actual),&engineering_result(expected),"3d");
}

#[test]
fn malformed_json_rejected_consistently() {
    assert!(native_api::solve_linear_2d_json("{broken").unwrap_err().contains("Parse error:"));
    assert!(native_api::solve_linear_3d_json("{broken").unwrap_err().contains("Parse error:"));
}
