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
        playback_available: std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("libmpv-2.dll")))
            .is_some_and(|p| p.is_file()),
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
    fn reports_version_without_network_access() {
        let info = app_info();
        assert_eq!(info.version, "0.1.0");
    }
}

#[tauri::command]
pub async fn play_media(
    media_id: String,
    episode_id: Option<String>,
    resume: Option<bool>,
    backend: State<'_, Arc<Backend>>,
    player: State<'_, crate::player::Player>,
    previews: State<'_, crate::previews::Previews>,
) -> Result<()> {
    let data = backend.inner().clone();
    let id = media_id.clone();
    let ep = episode_id.clone();
    let (url, position) = blocking(move || {
        Ok((
            data.playback_url(&id, ep.as_deref())?,
            if resume.unwrap_or(false) {
                data.resume_position(&id, ep.as_deref())?
            } else {
                0.0
            },
        ))
    })
    .await?;
    previews.suspend().await;
    let result = player.load(url, media_id, episode_id, position).await;
    if result.is_err() {
        previews.allow();
    }
    result
}

#[tauri::command]
pub async fn player_control(
    control: crate::player::Control,
    player: State<'_, crate::player::Player>,
    window: tauri::WebviewWindow,
    previews: State<'_, crate::previews::Previews>,
) -> Result<()> {
    if let crate::player::Control::Fullscreen(value) = control {
        return window
            .set_fullscreen(value)
            .map_err(|_| ServiceError::new("playback", "Não foi possível alterar a tela cheia."));
    }
    let stopping = matches!(control, crate::player::Control::Stop);
    let result = player.control(control).await;
    if stopping {
        previews.allow();
    }
    result
}
#[tauri::command]
pub fn player_status(
    player: State<'_, crate::player::Player>,
) -> Result<crate::player::PlaybackStatus> {
    player.status()
}

#[tauri::command]
pub async fn player_surface(
    rect: crate::surface::SurfaceRect,
    surface: State<'_, Arc<crate::surface::VideoSurface>>,
    window: tauri::WebviewWindow,
) -> Result<()> {
    let parent = window
        .hwnd()
        .map_err(|_| ServiceError::new("player_surface", "Janela indisponível."))?
        .0 as isize;
    let surface = surface.inner().clone();
    let (tx, rx) = tokio::sync::oneshot::channel();
    window
        .run_on_main_thread(move || {
            let _ = tx.send(surface.place(parent, rect));
        })
        .map_err(|_| ServiceError::new("player_surface", "Área de vídeo indisponível."))?;
    rx.await
        .map_err(|_| ServiceError::new("player_surface", "Área de vídeo indisponível."))?
}

#[tauri::command]
pub async fn library_state(
    media_id: String,
    backend: State<'_, Arc<Backend>>,
) -> Result<crate::core::models::LibraryState> {
    let backend = backend.inner().clone();
    blocking(move || backend.library(&media_id)).await
}
#[tauri::command]
pub async fn set_library(
    media_id: String,
    favorite: bool,
    watchlist: bool,
    backend: State<'_, Arc<Backend>>,
) -> Result<crate::core::models::LibraryState> {
    let backend = backend.inner().clone();
    blocking(move || backend.set_library(&media_id, favorite, watchlist)).await
}
#[tauri::command]
pub async fn save_progress(
    media_id: String,
    episode_id: Option<String>,
    position: f64,
    duration: f64,
    backend: State<'_, Arc<Backend>>,
) -> Result<()> {
    let backend = backend.inner().clone();
    blocking(move || backend.save_progress(&media_id, episode_id.as_deref(), position, duration))
        .await
}
#[tauri::command]
pub async fn thumbnail_for(
    media_id: String,
    episode_id: Option<String>,
    backend: State<'_, Arc<Backend>>,
    player: State<'_, crate::player::Player>,
    previews: State<'_, crate::previews::Previews>,
) -> Result<Option<ImageDto>> {
    let supplied = if let Some(episode) = episode_id.as_deref() {
        backend.episode_image(&media_id, episode).await
    } else {
        backend.image(&media_id).await
    };
    if let Ok(Some(image)) = supplied {
        return Ok(Some(image));
    }
    let data = backend.inner().clone();
    let id = media_id.clone();
    let ep = episode_id.clone();
    let url = blocking(move || data.playback_url(&id, ep.as_deref())).await?;
    let active = player.status()?.state;
    let key = format!("{media_id}:{}", episode_id.unwrap_or_default());
    previews
        .frame(&key, url, matches!(active.as_str(), "playing" | "loading"))
        .await
}
