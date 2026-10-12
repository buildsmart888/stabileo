#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};
use base64::Engine as _;

const MAX_FILE_BYTES: usize = 64 * 1024 * 1024;

#[derive(Default)]
struct FileState {
    active_by_tab: HashMap<String, PathBuf>,
    pending_open: Option<PathBuf>,
}

#[derive(Default)]
struct DesktopState(Mutex<FileState>);

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedProject {
    filename: String,
    content: String,
}

fn validate_project(content: &str) -> Result<(), String> {
    if content.is_empty() || content.len() > MAX_FILE_BYTES {
        return Err("Project is empty or larger than the 64 MiB safety limit.".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {e}"))?;
    if !value.is_object() {
        return Err("Project root must be an object.".into());
    }
    if value.get("type").and_then(|v| v.as_str()) == Some("session") {
        if !value.get("tabs").is_some_and(|v| v.is_array()) {
            return Err("Session has no tabs array.".into());
        }
    } else if !value.get("version").is_some_and(|v| v.is_string())
        || !value.get("snapshot").is_some_and(|v| v.is_object())
    {
        return Err("Not a Stabileo .ded project.".into());
    }
    Ok(())
}

fn read_project(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_FILE_BYTES as u64 {
        return Err("Project is larger than 64 MiB.".into());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    validate_project(&content)?;
    Ok(content)
}

fn safe_filename(name: &str) -> String {
    let safe: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | ' ' | '.'))
        .take(96)
        .collect();
    let stem = safe.trim_matches(|c: char| c == '.' || c.is_whitespace());
    if stem.is_empty() {
        "structure.ded".to_string()
    } else if stem.to_ascii_lowercase().ends_with(".ded") {
        stem.to_string()
    } else {
        format!("{stem}.ded")
    }
}

fn backup_and_write(path: &Path, content: &str) -> Result<(), String> {
    validate_project(content)?;
    let parent = path.parent().ok_or("Cannot find project directory")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    // Write alongside the original: a failed write cannot truncate the only good copy.
    let tmp = parent.join(format!(
        ".{}.go-tmp",
        path.file_name().unwrap_or_default().to_string_lossy()
    ));
    fs::write(&tmp, content).map_err(|e| e.to_string())?;

    if path.exists() {
        let backup = path.with_extension("ded.bak");
        if let Err(e) = fs::copy(path, &backup) {
            let _ = fs::remove_file(&tmp);
            return Err(format!("Could not create backup: {e}"));
        }
    }
    // If replacement fails (e.g. locked Windows destination), leave original intact.
    fs::rename(&tmp, path).map_err(|e| {
        format!("Could not replace project file ({e}). Copy kept at {}", tmp.display())
    })
}

fn tab_key(id: &str) -> Result<String, String> {
    if id.is_empty() || id.len() > 100 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid tab id.".into());
    }
    Ok(id.to_string())
}

#[tauri::command]
async fn desktop_pick_project(state: State<'_, DesktopState>) -> Result<Option<OpenedProject>, String> {
    let chosen = tauri::async_runtime::spawn_blocking(|| -> Result<Option<(String, PathBuf)>, String> {
        let path = rfd::FileDialog::new()
            .add_filter("Stabileo project", &["ded", "json"])
            .pick_file();
        match path {
            Some(path) => Ok(Some((read_project(&path)?, path))),
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    if let Some((content, path)) = chosen {
        state.pending_open = Some(path.clone());
        Ok(Some(OpenedProject {
            filename: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            content,
        }))
    } else {
        state.pending_open = None;
        Ok(None)
    }
}

#[tauri::command]
fn desktop_commit_open(state: State<'_, DesktopState>, tab_id: String) -> Result<(), String> {
    let id = tab_key(&tab_id)?;
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let path = state.pending_open.take().ok_or("No pending file to commit")?;
    state.active_by_tab.insert(id, path);
    Ok(())
}

#[tauri::command]
fn desktop_abort_open(state: State<'_, DesktopState>) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.pending_open = None;
    Ok(())
}

#[tauri::command]
async fn desktop_save_project(
    state: State<'_, DesktopState>,
    tab_id: String,
    content: String,
    suggested_name: String,
    save_as: bool,
) -> Result<Option<String>, String> {
    validate_project(&content)?;
    let id = tab_key(&tab_id)?;
    let previous = state.0.lock().map_err(|e| e.to_string())?
        .active_by_tab.get(&id).cloned();

    let path = if save_as || previous.is_none() {
        let name = safe_filename(&suggested_name);
        tauri::async_runtime::spawn_blocking(move || {
            rfd::FileDialog::new()
                .add_filter("Stabileo project", &["ded"])
                .set_file_name(&name)
                .save_file()
        })
        .await
        .map_err(|e| e.to_string())?
    } else {
        previous
    };

    let Some(mut path) = path else { return Ok(None) };
    if path.extension().and_then(|s| s.to_str()).map(|s| !s.eq_ignore_ascii_case("ded")).unwrap_or(true) {
        path.set_extension("ded");
    }

    tauri::async_runtime::spawn_blocking({
        let write_path = path.clone();
        move || backup_and_write(&write_path, &content)
    })
    .await
    .map_err(|e| e.to_string())??;

    state.0.lock().map_err(|e| e.to_string())?
        .active_by_tab.insert(id, path.clone());
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn desktop_autosave(
    app: tauri::AppHandle,
    tab_id: String,
    content: String,
) -> Result<(), String> {
    validate_project(&content)?;
    let key = tab_key(&tab_id)?;
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?
        .join("recovery")
        .join(format!("{key}.ded"));
    tauri::async_runtime::spawn_blocking(move || backup_and_write(&path, &content))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn desktop_pick_recovery(app: tauri::AppHandle) -> Result<Option<OpenedProject>, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("recovery");
    if !dir.exists() { return Ok(None); }
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<OpenedProject>, String> {
        let path = rfd::FileDialog::new()
            .set_directory(&dir)
            .add_filter("Stabileo recovery", &["ded"])
            .pick_file();
        match path {
            Some(path) => Ok(Some(OpenedProject {
                filename: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                content: read_project(&path)?,
            })),
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}


const MAX_EXPORT_BYTES: usize = 48 * 1024 * 1024;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryEntry {
    id: String,
    model_name: String,
    modified_at_ms: u64,
    bytes: u64,
}

fn recovery_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("recovery"))
}

fn scan_recovery(dir: &Path) -> Result<Vec<RecoveryEntry>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for item in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = item.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|v| v.to_str()) != Some("ded") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|v| v.to_str()) else { continue };
        if tab_key(id).is_err() {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue };
        if metadata.len() == 0 || metadata.len() > MAX_FILE_BYTES as u64 {
            continue;
        }
        let Ok(content) = read_project(&path) else { continue };
        let model_name = serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| v.get("name").and_then(|s| s.as_str()).map(str::to_owned))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Untitled structure".to_string());
        let modified_at_ms = metadata
            .modified()
            .ok()
            .and_then(|ts| ts.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        result.push(RecoveryEntry {
            id: id.to_string(),
            model_name,
            modified_at_ms,
            bytes: metadata.len(),
        });
    }
    result.sort_by(|a, b| b.modified_at_ms.cmp(&a.modified_at_ms));
    result.truncate(50);
    Ok(result)
}

#[tauri::command]
async fn desktop_list_recovery(app: tauri::AppHandle) -> Result<Vec<RecoveryEntry>, String> {
    let dir = recovery_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || scan_recovery(&dir))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn desktop_read_recovery(app: tauri::AppHandle, id: String) -> Result<OpenedProject, String> {
    let id = tab_key(&id)?;
    let path = recovery_dir(&app)?.join(format!("{id}.ded"));
    tauri::async_runtime::spawn_blocking(move || -> Result<OpenedProject, String> {
        Ok(OpenedProject {
            filename: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            content: read_project(&path)?,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn safe_export_name(filename: &str, extension: &str) -> String {
    let base_name = filename.rsplit(&['/', '\\'][..]).next().unwrap_or("report");
    let lower = base_name.to_ascii_lowercase();
    let without_ext = if lower.ends_with(&format!(".{extension}")) {
        &base_name[..base_name.len() - extension.len() - 1]
    } else {
        base_name
    };
    let cleaned: String = without_ext
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | ' ' | '.'))
        .take(90)
        .collect();
    let stem = cleaned.trim_matches(|c: char| c == '.' || c.is_whitespace());
    format!("{}.{}", if stem.is_empty() { "Structural report" } else { stem }, extension)
}

fn decode_export(format: &str, content: &str) -> Result<(&'static str, Vec<u8>), String> {
    if content.is_empty() || content.len() > MAX_EXPORT_BYTES * 4 / 3 + 8 {
        return Err("Export exceeds the maximum file size or is empty.".to_string());
    }
    match format {
        "xlsx" => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(content.as_bytes())
                .map_err(|e| format!("Invalid Excel payload: {e}"))?;
            if !bytes.starts_with(b"PK\x03\x04") || bytes.len() > MAX_EXPORT_BYTES {
                return Err("Excel workbook is not a valid ZIP/XLSX payload.".into());
            }
            Ok(("xlsx", bytes))
        }
        "html" => {
            if !content.trim_start().to_ascii_lowercase().starts_with("<!doctype html>") {
                return Err("Invalid HTML calculation report.".into());
            }
            Ok(("html", content.as_bytes().to_vec()))
        }
        _ => Err("Unsupported export format.".into()),
    }
}

#[tauri::command]
async fn desktop_export_file(
    filename: String,
    format: String,
    contents: String,
) -> Result<Option<String>, String> {
    let (extension, bytes) = decode_export(&format, &contents)?;
    let safe_name = safe_export_name(&filename, extension);
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .add_filter(if extension == "xlsx" { "Excel workbook" } else { "HTML calculation report" }, &[extension])
            .set_file_name(&safe_name)
            .save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(mut path) = chosen else { return Ok(None) };
    if !path.extension().and_then(|v| v.to_str()).is_some_and(|v| v.eq_ignore_ascii_case(extension)) {
        path.set_extension(extension);
    }
    tauri::async_runtime::spawn_blocking({
        let output = path.clone();
        move || fs::write(&output, bytes).map_err(|e| format!("Cannot write exported file: {e}"))
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(Some(path.to_string_lossy().into_owned()))
}

fn main() {
    tauri::Builder::default()
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_pick_project,
            desktop_commit_open,
            desktop_abort_open,
            desktop_save_project,
            desktop_autosave,
            desktop_pick_recovery,
            desktop_list_recovery,
            desktop_read_recovery,
            desktop_export_file,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start GO Stabileo Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_projects_and_rejects_unknown_files() {
        assert!(validate_project(r#"{"version":"2.0","snapshot":{}}"#).is_ok());
        assert!(validate_project(r#"{"type":"session","tabs":[]}"#).is_ok());
        assert!(validate_project(r#"{"x":42}"#).is_err());
        assert!(validate_project("not json").is_err());
    }

    #[test]
    fn disallows_path_traversal_in_recovery_key() {
        assert!(tab_key("tab-123_ABC").is_ok());
        assert!(tab_key("../etc").is_err());
        assert!(tab_key("long/name").is_err());
    }

    #[test]
    fn validates_export_payload_and_blocks_unsupported_formats() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"PK\x03\x04xlsx-test");
        let (format, bytes) = decode_export("xlsx", &encoded).unwrap();
        assert_eq!(format, "xlsx");
        assert!(bytes.starts_with(b"PK\x03\x04"));
        assert!(decode_export("xlsx", "invalid-base64").is_err());
        assert!(decode_export("xlsx", "bm90LXppcA==").is_err());
        assert!(decode_export("pdf", "not-pdf").is_err());
        assert!(decode_export("html", "<!DOCTYPE html><html></html>").is_ok());
        assert!(decode_export("html", "<script>bad</script>").is_err());
    }

    #[test]
    fn export_filenames_cannot_escape_user_chosen_folder() {
        assert_eq!(safe_export_name("../report", "xlsx"), "report.xlsx");
        assert_eq!(safe_export_name(r"C:\fake\beam.xlsx", "xlsx"), "beam.xlsx");
        assert_eq!(safe_export_name("model.html", "html"), "model.html");
    }

    #[test]
    fn filenames_use_a_ded_extension() {
        assert_eq!(safe_filename("Column model"), "Column model.ded");
        assert_eq!(safe_filename("a.ded"), "a.ded");
        assert_eq!(safe_filename(""), "structure.ded");
    }
}
