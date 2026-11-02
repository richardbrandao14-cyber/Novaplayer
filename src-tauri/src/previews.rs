use crate::{
    player::{extract_frame, extract_storyboard},
    services::{cache::ImageDto, Result, ServiceError},
};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime},
};
struct ActivePreview {
    request_id: Option<String>,
    flag: Arc<AtomicBool>,
}
pub struct Previews {
    directory: PathBuf,
    dll: PathBuf,
    gate: tokio::sync::Mutex<()>,
    cancel: Mutex<Option<ActivePreview>>,
    suspended: AtomicBool,
}
impl Previews {
    pub fn new(directory: PathBuf, dll: PathBuf) -> Self {
        Self {
            directory,
            dll,
            gate: tokio::sync::Mutex::new(()),
            cancel: Mutex::new(None),
            suspended: AtomicBool::new(false),
        }
    }
    pub async fn suspend(&self) {
        self.suspended.store(true, Ordering::SeqCst);
        if let Ok(flag) = self.cancel.lock() {
            if let Some(flag) = flag.as_ref() {
                flag.flag.store(true, Ordering::Relaxed);
            }
        }
        let _guard = self.gate.lock().await;
    }
    pub fn allow(&self) {
        self.suspended.store(false, Ordering::SeqCst);
    }
    pub async fn frame(&self, id: &str, url: String, active: bool) -> Result<Option<ImageDto>> {
        let key = format!("{:x}.png", Sha256::digest(format!("{id}:{url}").as_bytes()));
        let file = self.directory.join(key);
        let cached = tokio::fs::metadata(&file).await.ok().is_some_and(|m| {
            m.len() < 5 * 1024 * 1024
                && m.modified()
                    .ok()
                    .and_then(|d| SystemTime::now().duration_since(d).ok())
                    .is_some_and(|v| v < Duration::from_secs(7 * 86400))
        });
        if cached {
            if let Ok(bytes) = tokio::fs::read(&file).await {
                return Ok(Some(dto(bytes)));
            }
        }
        if active || self.suspended.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let _guard = self.gate.lock().await;
        if self.suspended.load(Ordering::SeqCst) {
            return Ok(None);
        }
        tokio::fs::create_dir_all(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        let flag = Arc::new(AtomicBool::new(false));
        {
            let mut active = self.cancel.lock().map_err(|_| ServiceError::storage())?;
            // Um hover explicitamente pedido tem prioridade sobre thumbnails da página.
            if active.as_ref().is_some_and(|current| current.request_id.is_some()) {
                return Ok(None);
            }
            *active = Some(ActivePreview { request_id: None, flag: flag.clone() });
        }
        let directory = self.directory.join(uuid::Uuid::new_v4().to_string());
        let dll = self.dll.clone();
        let dir = directory.clone();
        let extraction_flag = flag.clone();
        let result = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(&dir).map_err(|_| ServiceError::storage())?;
            let mut result = extract_frame(&dll, &url, &dir, extraction_flag.clone(), 10.0);
            if result.is_err() && !extraction_flag.load(Ordering::Relaxed) {
                if let Ok(entries) = std::fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
                result = extract_frame(&dll, &url, &dir, extraction_flag, 0.0);
            }
            result
        })
        .await
        .map_err(|_| ServiceError::storage())?;
        let _ = tokio::fs::remove_dir_all(directory).await;
        self.clear_request(&flag);
        let bytes = match result {
            Ok(bytes) => bytes,
            Err(_) => return Ok(None),
        };
        self.persist(&file, &bytes).await?;
        Ok(Some(dto(bytes)))
    }
    /// Id é um token opaco único por hover, não o ID da mídia. Cache usa apenas
    /// hash da URL nativa; cancelar hover A nunca invalida pedido posterior B.
    pub async fn storyboard(&self, id: &str, url: String, active: bool) -> Result<Vec<ImageDto>> {
        let flag = Arc::new(AtomicBool::new(false));
        {
            let mut current = self.cancel.lock().map_err(|_| ServiceError::storage())?;
            if let Some(old) = current.as_ref() {
                old.flag.store(true, Ordering::Relaxed);
            }
            *current = Some(ActivePreview { request_id: Some(id.to_owned()), flag: flag.clone() });
        }
        let result = self.storyboard_inner(&url, active, flag.clone()).await;
        self.clear_request(&flag);
        result
    }
    pub fn cancel_storyboard(&self, id: &str) {
        if let Ok(current) = self.cancel.lock() {
            if let Some(current) = current.as_ref().filter(|value| value.request_id.as_deref() == Some(id)) {
                current.flag.store(true, Ordering::Relaxed);
            }
        }
    }
    fn clear_request(&self, flag: &Arc<AtomicBool>) {
        if let Ok(mut current) = self.cancel.lock() {
            if current.as_ref().is_some_and(|value| Arc::ptr_eq(&value.flag, flag)) {
                *current = None;
            }
        }
    }
    async fn storyboard_inner(&self, url: &str, active: bool, flag: Arc<AtomicBool>) -> Result<Vec<ImageDto>> {
        let key = format!("story-{:x}", Sha256::digest(url.as_bytes()));
        let cached = self.cached_storyboard(&key).await;
        if !cached.is_empty() && !flag.load(Ordering::Relaxed) {
            return Ok(cached);
        }
        if active || self.suspended.load(Ordering::SeqCst) || flag.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }
        let _guard = self.gate.lock().await;
        if self.suspended.load(Ordering::SeqCst) || flag.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }
        // Pode ter sido concluído enquanto este pedido aguardava a fila.
        let cached = self.cached_storyboard(&key).await;
        if !cached.is_empty() { return Ok(cached); }
        tokio::fs::create_dir_all(&self.directory).await.map_err(|_| ServiceError::storage())?;
        let directory = self.directory.join(uuid::Uuid::new_v4().to_string());
        let dll = self.dll.clone();
        let dir = directory.clone();
        let url = url.to_owned();
        let cancel = flag.clone();
        let task = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(&dir).map_err(|_| ServiceError::storage())?;
            extract_storyboard(&dll, &url, &dir, cancel)
        }).await;
        let _ = tokio::fs::remove_dir_all(directory).await;
        if flag.load(Ordering::Relaxed) || self.suspended.load(Ordering::SeqCst) {
            return Ok(Vec::new());
        }
        let frames = match task {
            Ok(Ok(frames)) => frames,
            _ => return Ok(Vec::new()),
        };
        let mut images = Vec::new();
        for (index, bytes) in frames.into_iter().take(3).enumerate() {
            if flag.load(Ordering::Relaxed) { return Ok(Vec::new()); }
            let path = self.directory.join(format!("{key}-{index}.png"));
            self.persist(&path, &bytes).await?;
            images.push(dto(bytes));
        }
        Ok(images)
    }
    async fn cached_storyboard(&self, key: &str) -> Vec<ImageDto> {
        let mut images = Vec::new();
        for index in 0..3 {
            let file = self.directory.join(format!("{key}-{index}.png"));
            let fresh = tokio::fs::metadata(&file).await.ok().is_some_and(|meta| {
                meta.len() <= 2 * 1024 * 1024 && meta.modified().ok()
                    .and_then(|time| SystemTime::now().duration_since(time).ok())
                    .is_some_and(|age| age < Duration::from_secs(7 * 86400))
            });
            if !fresh { break; }
            match tokio::fs::read(file).await {
                Ok(bytes) if image::load_from_memory(&bytes).is_ok_and(|image| image.width() <= 640 && image.height() <= 360) => images.push(dto(bytes)),
                _ => break,
            }
        }
        images
    }
    async fn persist(&self, file: &std::path::Path, bytes: &[u8]) -> Result<()> {
        // Quota fixa; frames antigos são removidos antes de persistir uma nova imagem.
        let mut files = Vec::new();
        let mut size = bytes.len() as u64;
        let mut entries = tokio::fs::read_dir(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|_| ServiceError::storage())?
        {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_dir() {
                    let _ = tokio::fs::remove_dir_all(entry.path()).await;
                } else if meta.is_file() {
                    size += meta.len();
                    files.push((
                        meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
                        meta.len(),
                        entry.path(),
                    ));
                }
            }
        }
        files.sort_by_key(|v| v.0);
        for (_, length, path) in files {
            if size <= 64 * 1024 * 1024 {
                break;
            }
            let _ = tokio::fs::remove_file(path).await;
            size = size.saturating_sub(length);
        }
        let temporary = file.with_extension("tmp");
        tokio::fs::write(&temporary, &bytes)
            .await
            .map_err(|_| ServiceError::storage())?;
        let _ = tokio::fs::remove_file(&file).await;
        tokio::fs::rename(temporary, file)
            .await
            .map_err(|_| ServiceError::storage())?;
        Ok(())
    }

}
fn dto(bytes: Vec<u8>) -> ImageDto {
    ImageDto {
        mime: "image/png".into(),
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}
