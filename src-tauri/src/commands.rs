use crate::{
    core::models::{CatalogPage, CatalogQuery, SourceDto},
    services::{
        cache::ImageDto,
        imports::{Backend, JobStatus, SourceDraft},
        xtream::SeasonDto,
        Result, ServiceError,
    },
};
use std::sync::Arc;
use tauri::State;
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: &'static str,
    pub playback_available: bool,
}
#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        playback_available: false,
    }
}
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| ServiceError::storage())?
}
#[tauri::command]
pub async fn list_sources(backend: State<'_, Arc<Backend>>) -> Result<Vec<SourceDto>> {
    let backend = backend.inner().clone();
    blocking(move || backend.sources()).await
}
#[tauri::command]
pub async fn save_source(
    draft: SourceDraft,
    backend: State<'_, Arc<Backend>>,
) -> Result<SourceDto> {
    let backend = backend.inner().clone();
    blocking(move || backend.save_source(draft)).await
}
#[tauri::command]
pub async fn pick_m3u_file(
    name: String,
    backend: State<'_, Arc<Backend>>,
) -> Result<Option<SourceDto>> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Playlists M3U", &["m3u", "m3u8"])
        .pick_file()
        .await;
    let Some(file) = file else { return Ok(None) };
    let path = file.path().to_path_buf();
    let backend = backend.inner().clone();
    blocking(move || backend.add_local(name, path).map(Some)).await
}
#[tauri::command]
pub async fn remove_source(source_id: String, backend: State<'_, Arc<Backend>>) -> Result<()> {
    backend.remove_source(&source_id).await
}
#[tauri::command]
pub async fn start_import(source_id: String, backend: State<'_, Arc<Backend>>) -> Result<String> {
    let backend = backend.inner().clone();
    blocking(move || backend.start(source_id)).await
}
#[tauri::command]
pub async fn cancel_import(job_id: String, backend: State<'_, Arc<Backend>>) -> Result<()> {
    backend.cancel(&job_id)
}
#[tauri::command]
pub async fn import_status(job_id: String, backend: State<'_, Arc<Backend>>) -> Result<JobStatus> {
    backend.status(&job_id)
}
#[tauri::command]
pub async fn query_catalog(
    query: CatalogQuery,
    backend: State<'_, Arc<Backend>>,
) -> Result<CatalogPage> {
    let backend = backend.inner().clone();
    blocking(move || backend.query(&query)).await
}
#[tauri::command]
pub async fn list_categories(
    source_id: Option<String>,
    kind: Option<String>,
    backend: State<'_, Arc<Backend>>,
) -> Result<Vec<String>> {
    let backend = backend.inner().clone();
    blocking(move || backend.categories(source_id.as_deref(), kind.as_deref())).await
}
#[tauri::command]
pub async fn series_details(
    media_id: String,
    backend: State<'_, Arc<Backend>>,
) -> Result<Vec<SeasonDto>> {
    backend.series(&media_id).await
}
#[tauri::command]
pub async fn image_for(
    media_id: String,
    backend: State<'_, Arc<Backend>>,
) -> Result<Option<ImageDto>> {
    backend.image(&media_id).await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn foundation_never_claims_native_playback() {
        let info = app_info();
        assert!(!info.playback_available);
        assert_eq!(info.version, "0.1.0");
    }
}
