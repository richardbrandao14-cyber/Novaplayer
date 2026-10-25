use crate::{
    player::extract_frame,
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
pub struct Previews {
    directory: PathBuf,
    dll: PathBuf,
    gate: tokio::sync::Mutex<()>,
    cancel: Mutex<Option<Arc<AtomicBool>>>,
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
                flag.store(true, Ordering::Relaxed);
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
        *self.cancel.lock().map_err(|_| ServiceError::storage())? = Some(flag.clone());
        let directory = self.directory.join(uuid::Uuid::new_v4().to_string());
        let dll = self.dll.clone();
        let dir = directory.clone();
        let result = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(&dir).map_err(|_| ServiceError::storage())?;
            let mut result = extract_frame(&dll, &url, &dir, flag.clone(), 10.0);
            if result.is_err() && !flag.load(Ordering::Relaxed) {
                if let Ok(entries) = std::fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
                result = extract_frame(&dll, &url, &dir, flag, 0.0);
            }
            result
        })
        .await
        .map_err(|_| ServiceError::storage())?;
        let _ = tokio::fs::remove_dir_all(directory).await;
        *self.cancel.lock().map_err(|_| ServiceError::storage())? = None;
        let bytes = match result {
            Ok(bytes) => bytes,
            Err(_) => return Ok(None),
        };
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
        Ok(Some(dto(bytes)))
    }
}
fn dto(bytes: Vec<u8>) -> ImageDto {
    ImageDto {
        mime: "image/png".into(),
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}
