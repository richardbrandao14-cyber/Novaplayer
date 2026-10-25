use super::{
    cache::{ImageCache, ImageDto},
    http::HttpClient,
    xtream::{SeasonDto, SourceConfig, XtreamClient},
    Result, ServiceError,
};
use crate::core::{
    db::{Database, Protector},
    m3u::{parse_bytes, ParseLimits},
    models::{CatalogPage, CatalogQuery, ImportReport, SourceDto},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tokio::io::AsyncReadExt;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDraft {
    pub name: String,
    pub kind: String,
    pub url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub source_id: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatus {
    pub id: String,
    pub source_id: String,
    pub state: String,
    pub processed: usize,
    pub invalid: usize,
    pub total: Option<usize>,
    pub added: Option<usize>,
    pub removed: Option<usize>,
    pub error: Option<ServiceError>,
    pub report: Option<ImportReport>,
}
struct Job {
    status: JobStatus,
    cancel: Arc<AtomicBool>,
}
pub struct Backend {
    db: Mutex<Database>,
    protector: Arc<dyn Protector>,
    http: HttpClient,
    jobs: Mutex<HashMap<String, Job>>,
    cache: ImageCache,
}
impl Backend {
    pub fn new(
        db_path: PathBuf,
        cache_path: PathBuf,
        protector: Arc<dyn Protector>,
    ) -> Result<Arc<Self>> {
        let database = Database::open(&db_path).map_err(core_error)?;
        Ok(Arc::new(Self {
            db: Mutex::new(database),
            protector,
            http: HttpClient::new(64 * 1024 * 1024)?,
            jobs: Mutex::new(HashMap::new()),
            cache: ImageCache::new(cache_path)?,
        }))
    }
    pub fn sources(&self) -> Result<Vec<SourceDto>> {
        self.db
            .lock()
            .map_err(|_| ServiceError::storage())?
            .sources()
            .map_err(core_error)
    }
    pub fn save_source(&self, draft: SourceDraft) -> Result<SourceDto> {
        let url = HttpClient::validate_url(&draft.url)?;
        if !matches!(draft.kind.as_str(), "m3u" | "xtream")
            || draft.name.len() > 100
            || draft.username.len() > 512
            || draft.password.len() > 512
        {
            return Err(ServiceError::new("validation", "Dados da fonte inválidos."));
        }
        if draft.kind == "xtream" && (draft.username.is_empty() || draft.password.is_empty()) {
            return Err(ServiceError::new(
                "validation",
                "Informe usuário e senha do serviço Xtream.",
            ));
        }
        let name = if draft.name.trim().is_empty() {
            url.host_str().unwrap_or("Fonte").to_string()
        } else {
            draft.name.trim().to_string()
        };
        let config = SourceConfig {
            url: draft.url,
            username: draft.username,
            password: draft.password,
            local_path: None,
        };
        self.store_source(draft.source_id, name, draft.kind, config)
    }
    fn store_source(
        &self,
        id: Option<String>,
        name: String,
        kind: String,
        config: SourceConfig,
    ) -> Result<SourceDto> {
        let id = match id {
            Some(id) => {
                uuid::Uuid::parse_str(&id).map_err(|_| {
                    ServiceError::new("validation", "Identificador de fonte inválido.")
                })?;
                id
            }
            None => uuid::Uuid::new_v4().to_string(),
        };
        if self
            .jobs
            .lock()
            .map_err(|_| ServiceError::storage())?
            .values()
            .any(|v| v.status.source_id == id && !terminal(&v.status.state))
        {
            return Err(ServiceError::new(
                "busy",
                "Aguarde ou cancele a importação antes de editar esta fonte.",
            ));
        }
        let plain = serde_json::to_string(&config).map_err(|_| ServiceError::storage())?;
        let sealed = self.protector.encrypt(&plain).map_err(core_error)?;
        let mut db = self.db.lock().map_err(|_| ServiceError::storage())?;
        db.save_source(&id, &name, &kind, &sealed)
            .map_err(core_error)?;
        db.sources()
            .map_err(core_error)?
            .into_iter()
            .find(|v| v.id == id)
            .ok_or_else(ServiceError::storage)
    }
    pub fn add_local(&self, name: String, path: PathBuf) -> Result<SourceDto> {
        let extension = path
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(extension.as_str(), "m3u" | "m3u8") {
            return Err(ServiceError::new(
                "file",
                "Selecione um arquivo M3U ou M3U8.",
            ));
        }
        let metadata = std::fs::metadata(&path).map_err(|_| {
            ServiceError::new("file", "Não foi possível acessar o arquivo selecionado.")
        })?;
        if !metadata.is_file() || metadata.len() > 64 * 1024 * 1024 {
            return Err(ServiceError::new(
                "too_large",
                "Arquivo inválido ou acima de 64 MiB.",
            ));
        }
        let name = if name.trim().is_empty() {
            "Playlist local".into()
        } else {
            name.trim().to_owned()
        };
        if name.len() > 100 {
            return Err(ServiceError::new(
                "validation",
                "O nome da fonte excede 100 caracteres.",
            ));
        }
        let config = SourceConfig {
            url: String::new(),
            username: String::new(),
            password: String::new(),
            local_path: Some(path.to_string_lossy().into_owned()),
        };
        self.store_source(None, name, "file".into(), config)
    }
    pub async fn remove_source(self: &Arc<Self>, id: &str) -> Result<()> {
        {
            let mut jobs = self.jobs.lock().map_err(|_| ServiceError::storage())?;
            for job in jobs
                .values_mut()
                .filter(|v| v.status.source_id == id && !terminal(&v.status.state))
            {
                job.cancel.store(true, Ordering::Relaxed);
                job.status.state = "cancelled".into();
            }
        }
        let backend = self.clone();
        let source = id.to_owned();
        tokio::task::spawn_blocking(move || {
            backend
                .db
                .lock()
                .map_err(|_| ServiceError::storage())?
                .remove_source(&source)
                .map_err(core_error)
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        self.clean_cache().await;
        Ok(())
    }
    pub fn playback_url(&self, media_id: &str, episode_id: Option<&str>) -> Result<String> {
        let value = self
            .db
            .lock()
            .map_err(|_| ServiceError::storage())?
            .playback_url(media_id, episode_id, self.protector.as_ref())
            .map_err(core_error)?;
        HttpClient::validate_url(&value)?;
        Ok(value)
    }
    pub fn query(&self, query: &CatalogQuery) -> Result<CatalogPage> {
        self.db
            .lock()
            .map_err(|_| ServiceError::storage())?
            .catalog(query)
            .map_err(core_error)
    }
    pub fn categories(&self, source: Option<&str>, kind: Option<&str>) -> Result<Vec<String>> {
        self.db
            .lock()
            .map_err(|_| ServiceError::storage())?
            .categories(source, kind)
            .map_err(core_error)
    }
    fn config(&self, id: &str) -> Result<SourceConfig> {
        let data = self
            .db
            .lock()
            .map_err(|_| ServiceError::storage())?
            .source_config(id)
            .map_err(core_error)?;
        let plain = self.protector.decrypt(&data).map_err(core_error)?;
        serde_json::from_str(&plain).map_err(|_| ServiceError::storage())
    }
    pub fn start(self: &Arc<Self>, source_id: String) -> Result<String> {
        let sources = self.sources()?;
        if !sources.iter().any(|v| v.id == source_id) {
            return Err(ServiceError::new("not_found", "Fonte não encontrada."));
        }
        let mut jobs = self.jobs.lock().map_err(|_| ServiceError::storage())?;
        if jobs
            .values()
            .any(|v| v.status.source_id == source_id && !terminal(&v.status.state))
        {
            return Err(ServiceError::new(
                "busy",
                "Já existe uma importação em andamento para esta fonte.",
            ));
        }
        if jobs.values().filter(|v| !terminal(&v.status.state)).count() >= 2 {
            return Err(ServiceError::new(
                "busy",
                "Aguarde uma das importações em andamento terminar.",
            ));
        }
        if jobs.len() >= 100 {
            jobs.retain(|_, job| !terminal(&job.status.state));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let cancel = Arc::new(AtomicBool::new(false));
        jobs.insert(
            id.clone(),
            Job {
                status: JobStatus {
                    id: id.clone(),
                    source_id: source_id.clone(),
                    state: "connecting".into(),
                    processed: 0,
                    invalid: 0,
                    total: None,
                    added: None,
                    removed: None,
                    error: None,
                    report: None,
                },
                cancel: cancel.clone(),
            },
        );
        drop(jobs);
        self.update(&id, "connecting", 0, 0);
        self.persist_status(&id);
        let backend = self.clone();
        let job_id = id.clone();
        tokio::spawn(async move {
            let result = backend.import(&source_id, &job_id, cancel.clone()).await;
            match result {
                Ok(report) => backend.complete(&job_id, report),
                Err(error) => backend.fail(&job_id, error),
            }
            let finished = backend.clone();
            let _ = tokio::task::spawn_blocking(move || finished.persist_status(&job_id)).await;
        });
        Ok(id)
    }
    pub fn cancel(&self, id: &str) -> Result<()> {
        let jobs = self.jobs.lock().map_err(|_| ServiceError::storage())?;
        let job = jobs
            .get(id)
            .ok_or_else(|| ServiceError::new("not_found", "Importação não encontrada."))?;
        job.cancel.store(true, Ordering::Relaxed);
        Ok(())
    }
    pub fn status(&self, id: &str) -> Result<JobStatus> {
        self.jobs
            .lock()
            .map_err(|_| ServiceError::storage())?
            .get(id)
            .map(|v| v.status.clone())
            .ok_or_else(|| {
                ServiceError::new("not_found", "Importação não encontrada nesta sessão.")
            })
    }
    fn update(&self, id: &str, state: &str, processed: usize, invalid: usize) {
        if let Ok(mut jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get_mut(id) {
                job.status.state = state.into();
                job.status.processed = processed;
                job.status.invalid = invalid;
            }
        }
    }
    fn persist_status(&self, id: &str) {
        let snapshot = self.status(id).ok();
        if let Some(status) = snapshot {
            if let Ok(mut db) = self.db.lock() {
                let _ = db.save_job(
                    id,
                    &status.source_id,
                    &status.state,
                    status.processed as u64,
                    status.invalid as u64,
                    status
                        .error
                        .as_ref()
                        .map(|error| error.code)
                        .or(if status.invalid > 0 {
                            Some("invalid_entries")
                        } else {
                            None
                        }),
                );
            }
        }
    }
    fn complete(&self, id: &str, report: ImportReport) {
        self.update(
            id,
            "completed",
            report.valid as usize,
            report.invalid as usize,
        );
        if let Ok(mut jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get_mut(id) {
                job.status.total = Some(report.valid as usize + report.invalid as usize);
                job.status.added = Some(report.added as usize);
                job.status.removed = Some(report.removed as usize);
                job.status.report = Some(report);
            }
        }
    }
    fn fail(&self, id: &str, error: ServiceError) {
        let state = if error.code == "cancelled" {
            "cancelled"
        } else {
            "failed"
        };
        if let Ok(mut jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get_mut(id) {
                job.status.state = state.into();
                job.status.error = Some(error);
            }
        }
    }
    async fn import(
        self: &Arc<Self>,
        source_id: &str,
        job_id: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<ImportReport> {
        let backend = self.clone();
        let source = source_id.to_owned();
        let (config, source_kind) = tokio::task::spawn_blocking(move || {
            let config = backend.config(&source)?;
            let kind = backend
                .sources()?
                .into_iter()
                .find(|v| v.id == source)
                .map(|v| v.kind)
                .ok_or_else(|| ServiceError::new("not_found", "Fonte não encontrada."))?;
            Ok::<_, ServiceError>((config, kind))
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        let (items, invalid, warnings) = if source_kind == "xtream" {
            let client = XtreamClient::new(self.http.clone(), config);
            self.update(job_id, "authenticating", 0, 0);
            client.authenticate(cancel.clone()).await?;
            let (items, invalid) = client
                .catalog(cancel.clone(), |state, n| self.update(job_id, state, n, 0))
                .await?;
            (items, invalid, Vec::new())
        } else {
            self.update(job_id, "downloading", 0, 0);
            let bytes = if let Some(path) = config.local_path {
                let file = tokio::fs::File::open(path).await.map_err(|_| {
                    ServiceError::new("file", "Não foi possível ler o arquivo selecionado.")
                })?;
                let mut bytes = Vec::new();
                let mut limited = file.take(64 * 1024 * 1024 + 1);
                tokio::select! {result=limited.read_to_end(&mut bytes)=>{result.map_err(|_|ServiceError::new("file","Falha ao ler o arquivo selecionado."))?;},_=super::http::wait_cancel(cancel.clone())=>return Err(ServiceError::cancelled())};
                if bytes.len() > 64 * 1024 * 1024 {
                    return Err(ServiceError::new("too_large", "O arquivo excedeu 64 MiB."));
                }
                bytes
            } else {
                self.http
                    .bytes(HttpClient::validate_url(&config.url)?, cancel.clone())
                    .await?
            };
            self.update(job_id, "processing", 0, 0);
            let flag = cancel.clone();
            let parsed = tokio::task::spawn_blocking(move || {
                parse_bytes(&bytes, &ParseLimits::default(), &flag)
            })
            .await
            .map_err(|_| ServiceError::new("processing", "Falha ao processar a playlist."))?
            .map_err(core_error)?;
            (
                parsed.items,
                parsed.report.invalid as usize,
                parsed.report.warnings,
            )
        };
        if cancel.load(Ordering::Relaxed) {
            return Err(ServiceError::cancelled());
        }
        self.update(job_id, "saving", items.len(), invalid);
        let backend = self.clone();
        let source = source_id.to_string();
        let flag = cancel.clone();
        let mut report = tokio::task::spawn_blocking(move || {
            backend
                .db
                .lock()
                .map_err(|_| ServiceError::storage())?
                .replace_catalog(&source, &items, backend.protector.as_ref(), &flag)
                .map_err(core_error)
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        report.invalid += invalid as u64;
        report.warnings.extend(warnings);
        self.update(
            job_id,
            "finalizing",
            report.valid as usize,
            report.invalid as usize,
        );
        self.clean_cache().await;
        Ok(report)
    }
    async fn clean_cache(self: &Arc<Self>) {
        let backend = self.clone();
        let ids = tokio::task::spawn_blocking(move || {
            backend.db.lock().ok().and_then(|db| db.media_ids().ok())
        })
        .await
        .ok()
        .flatten();
        if let Some(ids) = ids {
            let _ = self.cache.clean_orphans(&ids).await;
        }
    }
    pub async fn image(self: &Arc<Self>, id: &str) -> Result<Option<ImageDto>> {
        let backend = self.clone();
        let media_id = id.to_owned();
        let url = tokio::task::spawn_blocking(move || {
            backend
                .db
                .lock()
                .map_err(|_| ServiceError::storage())?
                .artwork_url(&media_id, backend.protector.as_ref())
                .map_err(core_error)
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        match url {
            Some(url) => self.cache.image(id, &url).await.map(Some),
            None => Ok(None),
        }
    }
    pub async fn series(self: &Arc<Self>, id: &str) -> Result<Vec<SeasonDto>> {
        let backend = self.clone();
        let media_id = id.to_owned();
        let (external, config, key, cached) = tokio::task::spawn_blocking(move || {
            let media = backend
                .db
                .lock()
                .map_err(|_| ServiceError::storage())?
                .media(&media_id)
                .map_err(core_error)?;
            if media.kind != "series" {
                return Err(ServiceError::new(
                    "validation",
                    "Este item não é uma série.",
                ));
            }
            let config = backend.config(&media.source_id)?;
            let source = backend
                .sources()?
                .into_iter()
                .find(|s| s.id == media.source_id)
                .ok_or_else(|| ServiceError::new("not_found", "Fonte não encontrada."))?;
            if source.kind != "xtream" {
                return Err(ServiceError::new(
                    "provider",
                    "A fonte não oferece detalhes Xtream.",
                ));
            }
            let external = media.external_id.ok_or_else(|| {
                ServiceError::new("provider", "A fonte não forneceu o identificador da série.")
            })?;
            let key = format!("series:v2:{media_id}");
            let cached = backend
                .db
                .lock()
                .map_err(|_| ServiceError::storage())?
                .metadata_get(&key, backend.protector.as_ref())
                .map_err(core_error)?;
            Ok::<_, ServiceError>((external, config, key, cached))
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        if let Some(cached) = cached {
            if let Ok(value) = serde_json::from_str(&cached) {
                return Ok(value);
            }
        }
        let (mut seasons, episodes) = XtreamClient::new(self.http.clone(), config)
            .series(&external, Arc::new(AtomicBool::new(false)))
            .await?;
        // O contrato usa IDs internos de episódio, escopados à série e temporada.
        let mut occurrences = std::collections::HashMap::<String, u32>::new();
        for season in &mut seasons {
            for episode in &mut season.episodes {
                let key = format!("{id}:{}:{}", season.number, episode.id);
                let occurrence = occurrences.entry(key.clone()).or_default();
                *occurrence += 1;
                episode.id = format!("{key}:{occurrence}");
            }
        }
        let json = serde_json::to_string(&seasons).map_err(|_| ServiceError::storage())?;
        let backend = self.clone();
        let media_id = id.to_owned();
        tokio::task::spawn_blocking(move || {
            let mut db = backend.db.lock().map_err(|_| ServiceError::storage())?;
            db.replace_series_details(&media_id, &episodes, backend.protector.as_ref())
                .map_err(core_error)?;
            db.metadata_set(&key, &json, backend.protector.as_ref())
                .map_err(core_error)
        })
        .await
        .map_err(|_| ServiceError::storage())??;
        Ok(seasons)
    }
}
fn terminal(state: &str) -> bool {
    matches!(state, "completed" | "failed" | "cancelled")
}
fn core_error(error: crate::core::error::CoreError) -> ServiceError {
    match error.code.as_str() {
        "cancelled" => ServiceError::cancelled(),
        "secret_storage" => ServiceError::new(
            "secret_storage",
            "Não foi possível acessar o armazenamento protegido deste usuário Windows.",
        ),
        "empty_playlist" => ServiceError::new(
            "empty",
            "A playlist está vazia ou não contém registros válidos.",
        ),
        "hls_manifest" => ServiceError::new(
            "hls",
            "Este arquivo é um manifesto de reprodução HLS, não um catálogo IPTV.",
        ),
        "too_large" => ServiceError::new("too_large", "A playlist excedeu o limite permitido."),
        "encoding" => ServiceError::new("encoding", "A codificação da playlist não pôde ser lida."),
        "malformed" => ServiceError::new(
            "malformed",
            "A playlist não contém uma estrutura M3U válida.",
        ),
        "line_too_large" => ServiceError::new(
            "too_large",
            "Uma linha da playlist excedeu o limite permitido.",
        ),
        "too_many_records" => {
            ServiceError::new("too_large", "A playlist excedeu o limite de registros.")
        }
        "playback" => ServiceError::new("playback", "Esta mídia não tem endereço de reprodução."),
        "not_found" => ServiceError::new("not_found", "O registro solicitado não foi encontrado."),
        _ => ServiceError::storage(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::error::CoreResult;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        time::{Duration, Instant},
    };
    struct TestProtector;
    impl Protector for TestProtector {
        fn encrypt(&self, value: &str) -> CoreResult<Vec<u8>> {
            Ok(value.as_bytes().iter().map(|b| b ^ 0xa5).collect())
        }
        fn decrypt(&self, value: &[u8]) -> CoreResult<String> {
            String::from_utf8(value.iter().map(|b| b ^ 0xa5).collect())
                .map_err(|_| crate::core::error::CoreError::database())
        }
    }
    struct Fixture {
        directory: PathBuf,
        backend: Arc<Backend>,
    }
    impl Fixture {
        fn new() -> Self {
            let directory =
                std::env::temp_dir().join(format!("nova-import-tests-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&directory).unwrap();
            let backend = Backend::new(
                directory.join("test.sqlite"),
                directory.join("images"),
                Arc::new(TestProtector),
            )
            .unwrap();
            Self { directory, backend }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.directory);
        }
    }
    fn server(handler: impl Fn(&str) -> (u16, String) + Send + Sync + 'static) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for stream in listener.incoming().take(20) {
                let Ok(mut stream) = stream else { break };
                let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                let mut bytes = [0; 8192];
                let n = stream.read(&mut bytes).unwrap_or(0);
                let request = String::from_utf8_lossy(&bytes[..n]);
                let path = request.split_whitespace().nth(1).unwrap_or("/");
                let (code, body) = handler(path);
                let response = format!(
                    "HTTP/1.1 {code} OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes());
            }
        });
        format!("http://{address}")
    }
    async fn finished(backend: &Arc<Backend>, id: &str) -> JobStatus {
        tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                let status = backend.status(id).unwrap();
                if terminal(&status.state) {
                    return status;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap()
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn real_http_m3u_database_refresh_failure_and_secrets() {
        let fixture = Fixture::new();
        let body=Arc::new(Mutex::new("#EXTM3U\n#EXTINF:-1 tvg-id=\"original\" group-title=\"News\",Fixture\nhttps://streams.example.com/live?token=fixture-secret\n".to_string()));
        let shared = body.clone();
        let url = server(move |_| (200, shared.lock().unwrap().clone()));
        let source = fixture
            .backend
            .save_source(SourceDraft {
                name: "Fixture source".into(),
                kind: "m3u".into(),
                url,
                username: "".into(),
                password: "".into(),
                source_id: None,
            })
            .unwrap();
        let id = fixture.backend.start(source.id.clone()).unwrap();
        let status = finished(&fixture.backend, &id).await;
        assert_eq!(status.state, "completed");
        assert_eq!(status.processed, 1);
        let query = CatalogQuery {
            limit: 20,
            ..Default::default()
        };
        let page = fixture.backend.query(&query).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].name, "Fixture");
        assert!(!serde_json::to_string(&page)
            .unwrap()
            .contains("fixture-secret"));
        let raw = std::fs::read(fixture.directory.join("test.sqlite-wal")).unwrap_or_default();
        assert!(!String::from_utf8_lossy(&raw).contains("fixture-secret"));
        *body.lock().unwrap() = "not a playlist".into();
        let refresh = fixture.backend.start(source.id).unwrap();
        assert_eq!(finished(&fixture.backend, &refresh).await.state, "failed");
        assert_eq!(fixture.backend.query(&query).unwrap().total, 1);
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn local_file_registration_and_import_is_real() {
        let fixture = Fixture::new();
        let path = fixture.directory.join("playlist.m3u8");
        std::fs::write(
            &path,
            "#EXTM3U\n#EXTINF:-1,Local\nhttps://streams.example.com/local\n",
        )
        .unwrap();
        let source = fixture
            .backend
            .add_local("Local fixture".into(), path)
            .unwrap();
        assert_eq!(source.kind, "file");
        let job = fixture.backend.start(source.id).unwrap();
        assert_eq!(finished(&fixture.backend, &job).await.state, "completed");
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn xtream_http_auth_catalog_and_lazy_episode_details() {
        let fixture = Fixture::new();
        let details = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let count = details.clone();
        let url = server(move |path| {
            let parsed = url::Url::parse(&format!("http://fixture{path}")).unwrap();
            let query: HashMap<_, _> = parsed.query_pairs().into_owned().collect();
            let action = query.get("action").map(String::as_str);
            let response = match action {
                None => serde_json::json!({"user_info":{"auth":true,"status":"Active"}}),
                Some("get_live_categories" | "get_vod_categories" | "get_series_categories") => {
                    serde_json::json!([{"category_id":"7","category_name":"Fixture category"}])
                }
                Some("get_live_streams") => {
                    serde_json::json!([{"stream_id":1,"name":"Live fixture","category_id":7}])
                }
                Some("get_vod_streams") => serde_json::json!([{"stream_id":"2","category_id":"7"}]),
                Some("get_series") => {
                    serde_json::json!([{"series_id":3,"name":"Series fixture","category_id":"7"}])
                }
                Some("get_series_info") => {
                    count.fetch_add(1, Ordering::Relaxed);
                    serde_json::json!({"episodes":{"1":[{"id":101,"title":"Episode fixture","container_extension":"mp4","info":{"duration":"42:00","plot":"Local fixture"}}]}})
                }
                _ => serde_json::json!([]),
            };
            (200, response.to_string())
        });
        let source = fixture
            .backend
            .save_source(SourceDraft {
                name: "Xtream fixture".into(),
                kind: "xtream".into(),
                url,
                username: "fixture-user".into(),
                password: "fixture-password".into(),
                source_id: None,
            })
            .unwrap();
        let job = fixture.backend.start(source.id).unwrap();
        assert_eq!(finished(&fixture.backend, &job).await.state, "completed");
        assert_eq!(details.load(Ordering::Relaxed), 0);
        let page = fixture
            .backend
            .query(&CatalogQuery {
                limit: 20,
                kind: Some("series".into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(page.total, 1);
        let seasons = fixture.backend.series(&page.items[0].id).await.unwrap();
        assert_eq!(seasons[0].episodes[0].title, "Episode fixture");
        assert_eq!(details.load(Ordering::Relaxed), 1);
        fixture.backend.series(&page.items[0].id).await.unwrap();
        assert_eq!(details.load(Ordering::Relaxed), 1);
        let count: i64 = rusqlite::Connection::open(fixture.directory.join("test.sqlite"))
            .unwrap()
            .query_row("SELECT count(*) FROM episodes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn cancellation_during_response_preserves_previous_catalog() {
        let fixture = Fixture::new();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut b = [0; 2048];
                let _ = stream.read(&mut b);
                let _=stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5000\r\nConnection: close\r\n\r\n#EXTM3U\n");
                std::thread::sleep(Duration::from_secs(1));
            }
        });
        let source = fixture
            .backend
            .save_source(SourceDraft {
                name: "Cancellation fixture".into(),
                kind: "m3u".into(),
                url: format!("http://{address}"),
                username: String::new(),
                password: String::new(),
                source_id: None,
            })
            .unwrap();
        let job = fixture.backend.start(source.id).unwrap();
        tokio::time::sleep(Duration::from_millis(60)).await;
        let now = Instant::now();
        fixture.backend.cancel(&job).unwrap();
        assert_eq!(finished(&fixture.backend, &job).await.state, "cancelled");
        assert!(now.elapsed() < Duration::from_secs(1));
    }
}
