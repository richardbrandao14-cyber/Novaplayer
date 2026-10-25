use super::{http::HttpClient, Result, ServiceError};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    future::Future,
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc, Weak},
    time::{Duration, SystemTime},
};
use tokio::sync::{Mutex, Semaphore};
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDto {
    pub mime: String,
    pub base64: String,
}
pub struct ImageCache {
    directory: PathBuf,
    lock: Mutex<()>,
    downloads: Semaphore,
    processing: Semaphore,
    keys: Mutex<HashMap<String, Weak<Mutex<()>>>>,
    http: HttpClient,
    max_storage: u64,
    ttl: Duration,
}
impl ImageCache {
    pub fn new(directory: PathBuf) -> Result<Self> {
        Ok(Self {
            directory,
            lock: Mutex::new(()),
            downloads: Semaphore::new(4),
            processing: Semaphore::new(2),
            keys: Mutex::new(HashMap::new()),
            http: HttpClient::new(5 * 1024 * 1024)?,
            max_storage: 128 * 1024 * 1024,
            ttl: Duration::from_secs(7 * 24 * 3600),
        })
    }
    pub async fn image(&self, media_id: &str, url: &str) -> Result<ImageDto> {
        self.image_with(media_id, url, async {
            tokio::time::timeout(
                Duration::from_secs(12),
                self.http.image(
                    HttpClient::validate_url(url)?,
                    Arc::new(AtomicBool::new(false)),
                ),
            )
            .await
            .map_err(|_| ServiceError::new("timeout", "A imagem demorou demais para responder."))?
            .map(|value| value.0)
        })
        .await
    }
    async fn cached(&self, path: &Path) -> Option<ImageDto> {
        let meta = tokio::fs::metadata(path).await.ok()?;
        if meta.len() > 5 * 1024 * 1024 || meta.modified().ok()?.elapsed().ok()? >= self.ttl {
            return None;
        }
        let bytes = tokio::fs::read(path).await.ok()?;
        let mime = raster_type(&bytes).ok()?;
        Some(dto(bytes, mime))
    }
    async fn image_with<F: Future<Output = Result<Vec<u8>>>>(
        &self,
        media_id: &str,
        url: &str,
        fetch: F,
    ) -> Result<ImageDto> {
        let identity = format!("{:x}", Sha256::digest(media_id.as_bytes()));
        let key = format!("{}-{:x}", identity, Sha256::digest(url.as_bytes()));
        let path = self.directory.join(&key);
        // Cache hits não aguardam downloads lentos de outras capas.
        if let Some(data) = self.cached(&path).await {
            return Ok(data);
        }
        let key_lock = {
            let mut keys = self.keys.lock().await;
            keys.retain(|_, value| value.strong_count() > 0);
            match keys.get(&key).and_then(Weak::upgrade) {
                Some(lock) => lock,
                None => {
                    let lock = Arc::new(Mutex::new(()));
                    keys.insert(key.clone(), Arc::downgrade(&lock));
                    lock
                }
            }
        };
        let _key_guard = key_lock.lock().await;
        if let Some(data) = self.cached(&path).await {
            return Ok(data);
        }
        let permit = self
            .downloads
            .acquire()
            .await
            .map_err(|_| ServiceError::storage())?;
        let bytes = fetch.await?;
        let processing = self
            .processing
            .acquire()
            .await
            .map_err(|_| ServiceError::storage())?;
        let bytes = tokio::task::spawn_blocking(move || normalize_image(bytes))
            .await
            .map_err(|_| ServiceError::new("image", "Falha ao processar a imagem."))??;
        drop(processing);
        drop(permit);
        let mime = raster_type(&bytes)?;
        // Somente limpeza/escrita são serializadas; quota continua respeitada.
        let _guard = self.lock.lock().await;
        tokio::fs::create_dir_all(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        self.clean(bytes.len() as u64).await?;
        let mut entries = tokio::fs::read_dir(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|_| ServiceError::storage())?
        {
            if entry
                .file_name()
                .to_string_lossy()
                .starts_with(&format!("{identity}-"))
            {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
        let temporary = self.directory.join(format!("{key}.tmp"));
        tokio::fs::write(&temporary, &bytes)
            .await
            .map_err(|_| ServiceError::storage())?;
        let _ = tokio::fs::remove_file(&path).await;
        tokio::fs::rename(&temporary, &path)
            .await
            .map_err(|_| ServiceError::storage())?;
        Ok(dto(bytes, mime))
    }
    async fn clean(&self, reserve: u64) -> Result<()> {
        let mut entries = tokio::fs::read_dir(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        let mut files = Vec::new();
        let mut total = 0;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|_| ServiceError::storage())?
        {
            let meta = entry
                .metadata()
                .await
                .map_err(|_| ServiceError::storage())?;
            if !meta.is_file() {
                continue;
            }
            let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            let expired = SystemTime::now()
                .duration_since(modified)
                .unwrap_or_default()
                > self.ttl;
            let temporary = entry.path().extension().is_some_and(|ext| ext == "tmp");
            if expired || temporary {
                let _ = tokio::fs::remove_file(entry.path()).await;
            } else {
                total += meta.len();
                files.push((modified, meta.len(), entry.path()));
            }
        }
        files.sort_by_key(|v| v.0);
        for (_, size, path) in files {
            if total + reserve <= self.max_storage {
                break;
            }
            tokio::fs::remove_file(path)
                .await
                .map_err(|_| ServiceError::storage())?;
            total = total.saturating_sub(size);
        }
        Ok(())
    }
    pub async fn clean_orphans(&self, valid_ids: &[String]) -> Result<()> {
        let valid = valid_ids
            .iter()
            .map(|id| format!("{:x}", Sha256::digest(id.as_bytes())))
            .collect::<std::collections::HashSet<_>>();
        if !Path::new(&self.directory).exists() {
            return Ok(());
        }
        let _guard = self.lock.lock().await;
        let mut entries = tokio::fs::read_dir(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|_| ServiceError::storage())?
        {
            if !valid.contains(
                entry
                    .file_name()
                    .to_string_lossy()
                    .split('-')
                    .next()
                    .unwrap_or(""),
            ) {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
        Ok(())
    }
}
fn dto(bytes: Vec<u8>, mime: &str) -> ImageDto {
    ImageDto {
        mime: mime.into(),
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}
fn raster_type(bytes: &[u8]) -> Result<&'static str> {
    let format = image::guess_format(bytes)
        .map_err(|_| ServiceError::new("image", "Formato de imagem não suportado."))?;
    let mime = match format {
        image::ImageFormat::Png => "image/png",
        image::ImageFormat::Jpeg => "image/jpeg",
        image::ImageFormat::Gif => "image/gif",
        image::ImageFormat::WebP => "image/webp",
        _ => {
            return Err(ServiceError::new(
                "image",
                "Formato de imagem não suportado.",
            ))
        }
    };
    let reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), format);
    let (width, height) = reader
        .into_dimensions()
        .map_err(|_| ServiceError::new("image", "Imagem inválida."))?;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > 16_000_000 {
        return Err(ServiceError::new(
            "image",
            "A imagem excede o limite de dimensões.",
        ));
    }
    Ok(mime)
}

fn normalize_image(bytes: Vec<u8>) -> Result<Vec<u8>> {
    let format =
        image::guess_format(&bytes).map_err(|_| ServiceError::new("image", "Imagem inválida."))?;
    raster_type(&bytes)?;
    let mut reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    reader.limits(limits);
    let decoded = reader.decode().map_err(|_| {
        ServiceError::new("image", "Imagem inválida ou acima do limite de memória.")
    })?;
    let decoded = if decoded.width() > 1600 || decoded.height() > 1600 {
        decoded.thumbnail(1600, 1600)
    } else {
        decoded
    };
    let mut out = std::io::Cursor::new(Vec::new());
    if decoded.color().has_alpha() {
        decoded
            .write_to(&mut out, image::ImageFormat::Png)
            .map_err(|_| ServiceError::new("image", "Não foi possível preparar a imagem."))?;
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 88)
            .encode_image(&decoded)
            .map_err(|_| ServiceError::new("image", "Não foi possível preparar a imagem."))?;
    }
    let bytes = out.into_inner();
    if bytes.len() > 5 * 1024 * 1024 {
        return Err(ServiceError::new(
            "image",
            "A imagem processada excede 5 MiB.",
        ));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn picture() -> Vec<u8> {
        let mut data = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(64, 64)
            .write_to(&mut data, image::ImageFormat::Png)
            .unwrap();
        data.into_inner()
    }
    #[tokio::test]
    async fn concurrent_downloads_are_bounded_and_deduplicated() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let root = std::env::temp_dir().join(format!("nova-art-{}", uuid::Uuid::new_v4()));
        let cache = Arc::new(ImageCache::new(root.clone()).unwrap());
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let start = std::time::Instant::now();
        let mut jobs = tokio::task::JoinSet::new();
        for i in 0..6 {
            let cache = cache.clone();
            let active = active.clone();
            let peak = peak.clone();
            jobs.spawn(async move {
                cache
                    .image_with(
                        &format!("parallel-{i}"),
                        "https://example.org/fixture",
                        async {
                            let n = active.fetch_add(1, Ordering::SeqCst) + 1;
                            peak.fetch_max(n, Ordering::SeqCst);
                            tokio::time::sleep(Duration::from_millis(120)).await;
                            active.fetch_sub(1, Ordering::SeqCst);
                            Ok(picture())
                        },
                    )
                    .await
                    .unwrap()
            });
        }
        while let Some(result) = jobs.join_next().await {
            result.unwrap();
        }
        let parallel_ms = start.elapsed().as_millis();
        assert!(peak.load(Ordering::SeqCst) > 1);
        assert!(peak.load(Ordering::SeqCst) <= 4);
        let start = std::time::Instant::now();
        for i in 0..6 {
            cache
                .image_with(
                    &format!("serial-{i}"),
                    "https://example.org/fixture",
                    async {
                        tokio::time::sleep(Duration::from_millis(120)).await;
                        Ok(picture())
                    },
                )
                .await
                .unwrap();
        }
        eprintln!("ARTWORK_FIXTURE six_images latency_ms=120 parallel_ms={parallel_ms} serial_ms={} peak={}",start.elapsed().as_millis(),peak.load(Ordering::SeqCst));
        let calls = Arc::new(AtomicUsize::new(0));
        for _ in 0..3 {
            let cache = cache.clone();
            let calls = calls.clone();
            jobs.spawn(async move {
                cache
                    .image_with("shared", "https://example.org/shared", async {
                        calls.fetch_add(1, Ordering::SeqCst);
                        tokio::time::sleep(Duration::from_millis(80)).await;
                        Ok(picture())
                    })
                    .await
                    .unwrap()
            });
        }
        while let Some(result) = jobs.join_next().await {
            result.unwrap();
        }
        assert_eq!(
            calls.load(Ordering::SeqCst),
            1,
            "Mesma capa deve baixar uma única vez"
        );
        let slow_cache = cache.clone();
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        let slow = tokio::spawn(async move {
            slow_cache
                .image_with("slow", "https://example.org/slow", async {
                    let _ = ready_tx.send(());
                    tokio::time::sleep(Duration::from_millis(350)).await;
                    Ok(picture())
                })
                .await
                .unwrap()
        });
        ready_rx.await.unwrap();
        tokio::time::timeout(
            Duration::from_millis(150),
            cache.image_with("shared", "https://example.org/shared", async {
                panic!("Cache hit não deve baixar novamente")
            }),
        )
        .await
        .unwrap()
        .unwrap();
        slow.await.unwrap();
        drop(cache);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn normalizes_dimensions_and_preserves_transparency() {
        let mut bytes = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(2000, 1000)
            .write_to(&mut bytes, image::ImageFormat::Png)
            .unwrap();
        let out = normalize_image(bytes.into_inner()).unwrap();
        let decoded = image::load_from_memory(&out).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (1600, 800));
        assert_eq!(raster_type(&out).unwrap(), "image/jpeg");
        let mut bytes = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgba8(20, 20)
            .write_to(&mut bytes, image::ImageFormat::Png)
            .unwrap();
        assert_eq!(
            raster_type(&normalize_image(bytes.into_inner()).unwrap()).unwrap(),
            "image/png"
        );
    }
    #[test]
    fn rejects_active_and_invalid_content() {
        assert!(raster_type(b"<svg xmlns='http://www.w3.org/2000/svg'/>").is_err());
        assert!(raster_type(b"not an image").is_err());
    }
}
