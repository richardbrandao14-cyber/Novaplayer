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
            let dll = std::env::current_exe()?
                .parent()
                .ok_or("Diretório do aplicativo indisponível")?
                .join("libmpv-2.dll");
            app.manage(crate::player::Player::new(dll));
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
            commands::play_media,
            commands::player_control,
            commands::player_status,
            commands::image_for
        ])
        .build(tauri::generate_context!())
        .expect("Não foi possível iniciar o NOVA PLAYER")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<crate::player::Player>().shutdown();
            }
        });
}
