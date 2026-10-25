fn main() {
    #[cfg(feature = "desktop")]
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "app_info",
            "list_sources",
            "save_source",
            "pick_m3u_file",
            "remove_source",
            "start_import",
            "cancel_import",
            "import_status",
            "query_catalog",
            "list_categories",
            "series_details",
            "image_for",
            "play_media",
            "player_control",
            "player_status",
        ]),
    ))
    .expect("Não foi possível preparar as permissões do aplicativo");
}
