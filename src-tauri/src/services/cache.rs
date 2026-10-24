use super::{http::HttpClient, Result, ServiceError};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc},
    time::{Duration, SystemTime},
};
use tokio::sync::Mutex;
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDto {
    pub mime: String,
    pub base64: String,
}
pub struct ImageCache {
    directory: PathBuf,
    lock: Mutex<()>,
    http: HttpClient,
    max_storage: u64,
    ttl: Duration,
}
impl ImageCache {
    pub fn new(directory: PathBuf) -> Result<Self> {
        Ok(Self {
            directory,
            lock: Mutex::new(()),
            http: HttpClient::new(5 * 1024 * 1024)?,
            max_storage: 128 * 1024 * 1024,
            ttl: Duration::from_secs(7 * 24 * 3600),
        })
    }
    pub async fn image(&self, media_id: &str, url: &str) -> Result<ImageDto> {
        let _guard = self.lock.lock().await;
        tokio::fs::create_dir_all(&self.directory)
            .await
            .map_err(|_| ServiceError::storage())?;
        let identity = format!("{:x}", Sha256::digest(media_id.as_bytes()));
        let key = format!("{}-{:x}", identity, Sha256::digest(url.as_bytes()));
        let path = self.directory.join(&key);
        if let Ok(meta) = tokio::fs::metadata(&path).await {
            if meta.len() <= 5 * 1024 * 1024
                && meta
                    .modified()
                    .ok()
                    .and_then(|t| SystemTime::now().duration_since(t).ok())
                    .is_some_and(|age| age < self.ttl)
            {
                if let Ok(bytes) = tokio::fs::read(&path).await {
                    if let Ok(mime) = raster_type(&bytes) {
                        return Ok(dto(bytes, mime));
                    }
                }
            }
            let _ = tokio::fs::remove_file(&path).await;
        }
        let (bytes, _content_type) = self
            .http
            .image(
                HttpClient::validate_url(url)?,
                Arc::new(AtomicBool::new(false)),
            )
            .await?;
        let bytes = tokio::task::spawn_blocking(move || normalize_image(bytes))
            .await
            .map_err(|_| ServiceError::new("image", "Falha ao processar a imagem."))??;
        let mime = "image/png";
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
    let mut out = std::io::Cursor::new(Vec::new());
    decoded
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|_| ServiceError::new("image", "Não foi possível preparar a imagem."))?;
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
    #[test]
    fn rejects_active_and_invalid_content() {
        assert!(raster_type(b"<svg xmlns='http://www.w3.org/2000/svg'/>").is_err());
        assert!(raster_type(b"not an image").is_err());
    }
}
