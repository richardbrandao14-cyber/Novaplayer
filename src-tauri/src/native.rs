use crate::{
    commands,
    services::{imports::Backend, secrets::WindowsProtector},
};
use std::sync::Arc;
use tauri::Manager;
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let cache = app.path().app_cache_dir()?.join("artwork");
            let backend =
                Backend::new(data.join("nova.sqlite3"), cache, Arc::new(WindowsProtector))?;
            app.manage(backend);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::list_sources,
            commands::save_source,
            commands::pick_m3u_file,
            commands::remove_source,
            commands::start_import,
            commands::cancel_import,
            commands::import_status,
            commands::query_catalog,
            commands::list_categories,
            commands::series_details,
            commands::image_for
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o NOVA PLAYER");
}
