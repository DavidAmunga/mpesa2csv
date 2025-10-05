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
async fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    
    match std::path::Path::new(&path).exists() {
        true => {
            if let Err(e) = app.opener().open_url(format!("file://{}", path), None::<&str>) {
                Err(format!("Failed to open file: {}", e))
            } else {
                Ok(())
            }
        }
        false => Err("File not found".to_string())
    }
}

#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    default_filename: String,
    _file_type: String,
) -> Result<String, String> {
    #[cfg(not(mobile))]
    let (title, filter_name, extensions) = match _file_type.as_str() {
        "csv" => ("Save CSV File", "CSV Files", vec!["csv"]),
        "xlsx" => ("Save Excel File", "Excel Files", vec!["xlsx"]),
        _ => return Err("Unsupported file type".to_string()),
    };

    
    #[cfg(mobile)]
    {
        use tauri::path::BaseDirectory;
        use tauri::Manager;
        use std::fs;
        
        
        #[cfg(target_os = "android")]
        {
            use std::path::PathBuf;
            
            let possible_paths = vec![
                PathBuf::from("/storage/emulated/0/Download").join(&default_filename),
                PathBuf::from("/storage/emulated/0/Downloads").join(&default_filename),
                PathBuf::from("/sdcard/Download").join(&default_filename),
                PathBuf::from("/sdcard/Downloads").join(&default_filename),
            ];
            
            let mut last_error = String::new();
            
            for download_path in possible_paths {
                if let Some(parent) = download_path.parent() {
                    if parent.exists() || fs::create_dir_all(parent).is_ok() {
                        match fs::write(&download_path, &content) {
                            Ok(_) => return Ok(format!("File saved successfully to: {}", download_path.display())),
                            Err(e) => last_error = format!("Failed to write to {}: {}", download_path.display(), e),
                        }
                    }
                }
            }
            
            match app.path().resolve(&default_filename, BaseDirectory::Download) {
                Ok(path) => {
                    if let Some(parent) = path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    match fs::write(&path, &content) {
                        Ok(_) => Ok(format!("File saved successfully to: {}", path.display())),
                        Err(e) => Err(format!("Failed to save file after trying all locations. Last error: {}", e))
                    }
                },
                Err(e) => Err(format!("Failed to resolve any download path. Errors: {} | {}", last_error, e))
            }
        }
        
        #[cfg(not(target_os = "android"))]
        {
            
            let docs_dir = match app.path().resolve(&default_filename, BaseDirectory::Download) {
                Ok(path) => path,
                Err(e) => return Err(format!("Failed to resolve document path: {}", e))
            };
            
            
            match fs::write(&docs_dir, &content) {
                Ok(_) => Ok(format!("File saved successfully to: {}", docs_dir.display())),
                Err(e) => Err(format!("Failed to save file: {}", e))
            }
        }
    }
    
    #[cfg(not(mobile))]
    {
        use tauri_plugin_dialog::DialogExt;
        use std::fs;
        
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
                    Err(e) => Err(format!("Failed to write file: {}", e))
                }
            }
            None => {
                Err("Save dialog was cancelled".to_string())
            }
        }
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
        .invoke_handler(tauri::generate_handler![greet, save_csv_file, save_file, get_app_version, open_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}