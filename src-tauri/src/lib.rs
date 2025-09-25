// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_csv_file(
    app: tauri::AppHandle,
    csv_content: String,
    default_filename: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::fs;

    // Show save dialog
    let file_path = app
        .dialog()
        .file()
        .set_title("Save CSV File")
        .add_filter("CSV Files", &["csv"])
        .set_file_name(&default_filename)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            
            match fs::write(&path_buf, &csv_content) {
                Ok(_) => Ok(format!("File saved successfully to: {}", path_buf.display())),
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        }
        None => Err("Save dialog was cancelled".to_string()),
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    default_filename: String,
    file_type: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::fs;

    let (title, filter_name, extensions) = match file_type.as_str() {
        "csv" => ("Save CSV File", "CSV Files", vec!["csv"]),
        "xlsx" => ("Save Excel File", "Excel Files", vec!["xlsx"]),
        _ => return Err("Unsupported file type".to_string()),
    };

    // Show save dialog
    let file_path = app
        .dialog()
        .file()
        .set_title(title)
        .add_filter(filter_name, &extensions)
        .set_file_name(&default_filename)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            
            match fs::write(&path_buf, &content) {
                Ok(_) => Ok(format!("File saved successfully to: {}", path_buf.display())),
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        }
        None => Err("Save dialog was cancelled".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet, save_csv_file, save_file, get_app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
