use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn obter_identificador_instalacao() -> Result<String, String> {
    let executavel: PathBuf =
        std::env::current_exe().map_err(|erro| erro.to_string())?;

    let metadata = fs::metadata(&executavel).map_err(|erro| erro.to_string())?;

    let modificado = metadata
        .modified()
        .map_err(|erro| erro.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|erro| erro.to_string())?
        .as_nanos();

    Ok(format!(
        "{}:{}:{}",
        executavel.display(),
        metadata.len(),
        modificado
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            obter_identificador_instalacao
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}