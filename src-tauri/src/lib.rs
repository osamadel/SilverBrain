// Tauri entry point. The frontend handles all app logic; the Rust side just
// hosts the WebView and exposes the fs + http plugins:
//   - fs           → read/write the local settings.json and data.json files
//   - http         → proxy LLM provider calls so they bypass WebView CORS
//   - notification → native OS alerts when focus/break timers complete
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running Silver Brain");
}
