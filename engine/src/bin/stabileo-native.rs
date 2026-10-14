use std::{env, fs, io::{self, Write}, process};

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let dimension = args.next().ok_or("Usage: stabileo-native <2d|3d> <model.json>")?;
    let path = args.next().ok_or("Usage: stabileo-native <2d|3d> <model.json>")?;
    if args.next().is_some() {
        return Err("Usage: stabileo-native <2d|3d> <model.json>".into());
    }
    if dimension != "2d" && dimension != "3d" {
        return Err(format!("Unsupported analysis mode: {dimension} (expected 2d or 3d)"));
    }
    let json = fs::read_to_string(&path).map_err(|err| format!("Cannot read {path}: {err}"))?;
    let output = match dimension.as_str() {
        "2d" => dedaliano_engine::native_api::solve_linear_2d_json(&json)?,
        "3d" => dedaliano_engine::native_api::solve_linear_3d_json(&json)?,
        _ => unreachable!(),
    };
    let mut stdout = io::stdout().lock();
    writeln!(stdout, "{output}").map_err(|err| format!("Cannot write results: {err}"))?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}
