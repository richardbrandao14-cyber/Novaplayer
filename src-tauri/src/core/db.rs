use super::{
    error::{CoreError, CoreResult},
    models::*,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

pub trait Protector: Send + Sync {
    fn encrypt(&self, value: &str) -> CoreResult<Vec<u8>>;
    fn decrypt(&self, value: &[u8]) -> CoreResult<String>;
}
pub struct Database {
    connection: Connection,
}
fn db_error(_: rusqlite::Error) -> CoreError {
    CoreError::database()
}
fn item_row(row: &Row<'_>) -> rusqlite::Result<CatalogItem> {
    Ok(CatalogItem {
        id: row.get(0)?,
        source_id: row.get(1)?,
        external_id: row.get(2)?,
        name: row.get(3)?,
        kind: row.get(4)?,
        category: row.get(5)?,
        has_artwork: row.get(6)?,
        description: row.get(7)?,
        year: row.get(8)?,
        duration: row.get(9)?,
        rating: row.get(10)?,
    })
}
const ITEM_COLUMNS:&str="id,source_id,external_id,name,kind,category,artwork IS NOT NULL,description,year,duration,rating";
impl Database {
    pub fn open(path: impl AsRef<Path>) -> CoreResult<Self> {
        let connection = Connection::open(path).map_err(db_error)?;
        Self::initialize(connection)
    }
    pub fn memory() -> CoreResult<Self> {
        Self::initialize(Connection::open_in_memory().map_err(db_error)?)
    }
    fn initialize(mut connection: Connection) -> CoreResult<Self> {
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(db_error)?;
        connection
            .execute_batch("PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;")
            .map_err(db_error)?;
        let version: u32 = connection
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(db_error)?;
        if version > 1 {
            return Err(CoreError::new(
                "database_version",
                "O banco foi criado por uma versão mais recente do aplicativo.",
            ));
        }
        if version < 1 {
            let tx = connection.transaction().map_err(db_error)?;
            tx.execute_batch(include_str!("../../migrations/001_catalog.sql"))
                .map_err(db_error)?;
            tx.commit().map_err(db_error)?;
        }
        let recovery = connection.transaction().map_err(db_error)?;
        recovery.execute("UPDATE sources SET status='failed' WHERE id IN (SELECT source_id FROM import_jobs WHERE status NOT IN ('completed','failed','cancelled'))",[]).map_err(db_error)?;
        recovery.execute("INSERT INTO import_errors(job_id,code)SELECT id,'interrupted' FROM import_jobs WHERE status NOT IN ('completed','failed','cancelled')",[]).map_err(db_error)?;
        recovery.execute("UPDATE import_jobs SET status='failed',finished_at=unixepoch() WHERE status NOT IN ('completed','failed','cancelled')",[]).map_err(db_error)?;
        recovery.commit().map_err(db_error)?;
        Ok(Self { connection })
    }
    pub fn save_source(
        &mut self,
        id: &str,
        name: &str,
        kind: &str,
        sealed_config: &[u8],
    ) -> CoreResult<()> {
        if !matches!(kind, "m3u" | "file" | "xtream")
            || name.len() > 400
            || sealed_config.is_empty()
        {
            return Err(CoreError::new(
                "source_invalid",
                "A configuração da fonte é inválida.",
            ));
        }
        self.connection.execute("INSERT INTO sources(id,name,kind,config)VALUES(?1,?2,?3,?4) ON CONFLICT(id)DO UPDATE SET name=excluded.name,kind=excluded.kind,config=excluded.config,updated_at=unixepoch()",params![id,name,kind,sealed_config]).map_err(db_error)?;
        Ok(())
    }
    pub fn source_config(&self, id: &str) -> CoreResult<Vec<u8>> {
        self.connection
            .query_row("SELECT config FROM sources WHERE id=?1", [id], |r| r.get(0))
            .map_err(db_error)
    }
    pub fn sources(&self) -> CoreResult<Vec<SourceDto>> {
        let mut stmt=self.connection.prepare("SELECT id,name,kind,status,(SELECT count(*) FROM media_items WHERE source_id=sources.id) FROM sources ORDER BY updated_at DESC,id").map_err(db_error)?;
        let result = stmt
            .query_map([], |row| {
                Ok(SourceDto {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    kind: row.get(2)?,
                    status: row.get(3)?,
                    item_count: row.get::<_, i64>(4)? as u64,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error);
        result
    }
    pub fn remove_source(&mut self, id: &str) -> CoreResult<()> {
        self.connection
            .execute("DELETE FROM sources WHERE id=?1", [id])
            .map_err(db_error)?;
        Ok(())
    }
    pub fn replace_catalog(
        &mut self,
        source_id: &str,
        items: &[NormalizedItem],
        protector: &dyn Protector,
        cancel: &AtomicBool,
    ) -> CoreResult<ImportReport> {
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::cancelled());
        }
        if items.is_empty() {
            return Err(CoreError::new(
                "empty_playlist",
                "A fonte não contém registros válidos; o catálogo anterior foi preservado.",
            ));
        }
        let generation = uuid::Uuid::new_v4().to_string();
        let tx = self.connection.transaction().map_err(db_error)?;
        let source_exists: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sources WHERE id=?1)",
                [source_id],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if !source_exists {
            return Err(CoreError::new(
                "source_missing",
                "A fonte não foi encontrada.",
            ));
        }
        let old: HashSet<String> = {
            let mut s = tx
                .prepare("SELECT id FROM media_items WHERE source_id=?1")
                .map_err(db_error)?;
            let rows = s.query_map([source_id], |r| r.get(0)).map_err(db_error)?;
            rows.collect::<Result<HashSet<_>, _>>().map_err(db_error)?
        };
        let mut ids = HashSet::new();
        let mut occurrences: HashMap<String, u32> = HashMap::new();
        let mut report = ImportReport::default();
        {
            let mut insert=tx.prepare_cached("INSERT INTO media_items(id,source_id,generation,external_id,name,normalized_name,kind,category,stream,artwork,description,year,duration,rating)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14) ON CONFLICT(id)DO UPDATE SET generation=excluded.generation,external_id=excluded.external_id,name=excluded.name,normalized_name=excluded.normalized_name,kind=excluded.kind,category=excluded.category,stream=excluded.stream,artwork=excluded.artwork,description=excluded.description,year=excluded.year,duration=excluded.duration,rating=excluded.rating").map_err(db_error)?;
            for item in items {
                if cancel.load(Ordering::Relaxed) {
                    return Err(CoreError::cancelled());
                }
                let kind = if matches!(item.kind.as_str(), "live" | "movie" | "series") {
                    item.kind.as_str()
                } else {
                    "unknown"
                };
                // Scoped provider IDs are preferred. Ambiguous duplicates remain separate by occurrence.
                let identity = item
                    .external_id
                    .as_deref()
                    .filter(|s| !s.is_empty())
                    .or(item.stream_url.as_deref())
                    .unwrap_or("");
                let base = format!("{source_id}\0{kind}\0{identity}");
                let occurrence = occurrences.entry(base.clone()).or_default();
                *occurrence += 1;
                let mut hasher = Sha256::new();
                hasher.update(base.as_bytes());
                hasher.update(occurrence.to_be_bytes());
                let id = format!("{:x}", hasher.finalize());
                let stream = item
                    .stream_url
                    .as_deref()
                    .map(|s| protector.encrypt(s))
                    .transpose()?;
                let artwork = item
                    .artwork_url
                    .as_deref()
                    .map(|s| protector.encrypt(s))
                    .transpose()?;
                insert
                    .execute(params![
                        id,
                        source_id,
                        generation,
                        item.external_id,
                        item.name,
                        item.name.to_lowercase(),
                        kind,
                        item.category,
                        stream,
                        artwork,
                        item.description,
                        item.year,
                        item.duration,
                        item.rating
                    ])
                    .map_err(db_error)?;
                ids.insert(id);
                report.valid += 1;
            }
        }
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::cancelled());
        }
        tx.execute(
            "DELETE FROM media_items WHERE source_id=?1 AND generation<>?2",
            params![source_id, generation],
        )
        .map_err(db_error)?;
        tx.execute("DELETE FROM categories WHERE source_id=?1", [source_id])
            .map_err(db_error)?;
        tx.execute("INSERT INTO categories(source_id,kind,name)SELECT DISTINCT source_id,kind,category FROM media_items WHERE source_id=?1 AND category IS NOT NULL",[source_id]).map_err(db_error)?;
        tx.execute(
            "UPDATE sources SET generation=?2,status='ready',updated_at=unixepoch() WHERE id=?1",
            params![source_id, generation],
        )
        .map_err(db_error)?;
        report.added = ids.difference(&old).count() as u64;
        report.removed = old.difference(&ids).count() as u64;
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::cancelled());
        }
        tx.commit().map_err(db_error)?;
        Ok(report)
    }
    pub fn replace_series_details(
        &mut self,
        media_id: &str,
        entries: &[NormalizedEpisode],
        protector: &dyn Protector,
    ) -> CoreResult<()> {
        if entries.len() > 100_000 {
            return Err(CoreError::new(
                "too_many_records",
                "A série excede a quantidade permitida de episódios.",
            ));
        }
        let tx = self.connection.transaction().map_err(db_error)?;
        let is_series: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM media_items WHERE id=?1 AND kind='series')",
                [media_id],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if !is_series {
            return Err(CoreError::new(
                "series_missing",
                "A série não foi encontrada.",
            ));
        }
        tx.execute("DELETE FROM seasons WHERE series_id=?1", [media_id])
            .map_err(db_error)?;
        let mut occurrences = HashMap::<String, u32>::new();
        for entry in entries {
            let season_id = format!("{media_id}:{}", entry.season);
            tx.execute(
                "INSERT OR IGNORE INTO seasons(id,series_id,number)VALUES(?1,?2,?3)",
                params![season_id, media_id, entry.season],
            )
            .map_err(db_error)?;
            let occurrence = occurrences
                .entry(format!("{season_id}:{}", entry.external_id))
                .or_default();
            *occurrence += 1;
            let id = format!("{season_id}:{}:{occurrence}", entry.external_id);
            let stream = entry
                .stream_url
                .as_deref()
                .map(|value| protector.encrypt(value))
                .transpose()?;
            let artwork = entry
                .artwork_url
                .as_deref()
                .map(|value| protector.encrypt(value))
                .transpose()?;
            tx.execute("INSERT INTO episodes(id,season_id,external_id,name,stream,artwork,description,duration)VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",params![id,season_id,entry.external_id,entry.name,stream,artwork,entry.description,entry.duration]).map_err(db_error)?;
        }
        tx.commit().map_err(db_error)?;
        Ok(())
    }
    pub fn catalog(&self, query: &CatalogQuery) -> CoreResult<CatalogPage> {
        let limit = query.limit.clamp(1, 200);
        let search = query.search.as_deref().unwrap_or("").to_lowercase();
        if search.len() > 512 {
            return Err(CoreError::new(
                "query_invalid",
                "A busca excede o limite permitido.",
            ));
        }
        let escaped = search
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let pattern = format!("%{escaped}%");
        let filter="(?1 IS NULL OR source_id=?1) AND (?2 IS NULL OR kind=?2) AND (?3 IS NULL OR category=?3) AND normalized_name LIKE ?4 ESCAPE '\\'";
        let total: i64 = self
            .connection
            .query_row(
                &format!("SELECT count(*) FROM media_items WHERE {filter}"),
                params![query.source_id, query.kind, query.category, pattern],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        let order = if query.sort.as_deref() == Some("recent") {
            "year DESC,normalized_name,id"
        } else {
            "normalized_name,id"
        };
        let mut stmt=self.connection.prepare(&format!("SELECT {ITEM_COLUMNS} FROM media_items WHERE {filter} ORDER BY {order} LIMIT ?5 OFFSET ?6")).map_err(db_error)?;
        let items = stmt
            .query_map(
                params![
                    query.source_id,
                    query.kind,
                    query.category,
                    pattern,
                    limit,
                    query.offset
                ],
                item_row,
            )
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        let next = query.offset.saturating_add(items.len() as u32);
        Ok(CatalogPage {
            items,
            total: total as u64,
            next_offset: if i64::from(next) < total {
                Some(next)
            } else {
                None
            },
        })
    }
    pub fn categories(
        &self,
        source_id: Option<&str>,
        kind: Option<&str>,
    ) -> CoreResult<Vec<String>> {
        let mut stmt=self.connection.prepare("SELECT DISTINCT name FROM categories WHERE (?1 IS NULL OR source_id=?1) AND (?2 IS NULL OR kind=?2) ORDER BY name COLLATE NOCASE").map_err(db_error)?;
        let result = stmt
            .query_map(params![source_id, kind], |r| r.get(0))
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error);
        result
    }
    pub fn media_ids(&self) -> CoreResult<Vec<String>> {
        let mut stmt = self
            .connection
            .prepare("SELECT id FROM media_items ORDER BY id")
            .map_err(db_error)?;
        let result = stmt
            .query_map([], |r| r.get(0))
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error);
        result
    }
    pub fn media(&self, id: &str) -> CoreResult<CatalogItem> {
        self.connection
            .query_row(
                &format!("SELECT {ITEM_COLUMNS} FROM media_items WHERE id=?1"),
                [id],
                item_row,
            )
            .map_err(db_error)
    }
    /// Apenas para o backend nativo; nunca incluir este valor em DTOs IPC.
    pub fn playback_url(
        &self,
        media_id: &str,
        episode_id: Option<&str>,
        protector: &dyn Protector,
    ) -> CoreResult<String> {
        let data: Option<Vec<u8>> = if let Some(episode) = episode_id {
            self.connection.query_row("SELECT e.stream FROM episodes e JOIN seasons s ON s.id=e.season_id WHERE s.series_id=?1 AND e.id=?2", params![media_id, episode], |r| r.get(0)).optional().map_err(db_error)?.flatten()
        } else {
            self.connection
                .query_row(
                    "SELECT stream FROM media_items WHERE id=?1 AND kind!='series'",
                    [media_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(db_error)?
                .flatten()
        };
        let data =
            data.ok_or_else(|| CoreError::new("playback", "Mídia sem endereço de reprodução."))?;
        protector.decrypt(&data)
    }
    pub fn artwork_url(&self, id: &str, protector: &dyn Protector) -> CoreResult<Option<String>> {
        let data: Option<Vec<u8>> = self
            .connection
            .query_row("SELECT artwork FROM media_items WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(db_error)?
            .flatten();
        data.as_deref()
            .map(|bytes| protector.decrypt(bytes))
            .transpose()
    }
    pub fn save_job(
        &mut self,
        id: &str,
        source_id: &str,
        state: &str,
        processed: u64,
        invalid: u64,
        error_code: Option<&str>,
    ) -> CoreResult<()> {
        let terminal = matches!(state, "completed" | "failed" | "cancelled");
        self.connection.execute("INSERT INTO import_jobs(id,source_id,status,valid,invalid,finished_at)VALUES(?1,?2,?3,?4,?5,CASE WHEN ?6 THEN unixepoch() ELSE NULL END)ON CONFLICT(id)DO UPDATE SET status=excluded.status,valid=excluded.valid,invalid=excluded.invalid,finished_at=excluded.finished_at",params![id,source_id,state,processed as i64,invalid as i64,terminal]).map_err(db_error)?;
        self.connection
            .execute(
                "UPDATE sources SET status=?2 WHERE id=?1",
                params![source_id, state],
            )
            .map_err(db_error)?;
        if let Some(code) = error_code {
            if !code.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                return Err(CoreError::new(
                    "error_code_invalid",
                    "Código de diagnóstico inválido.",
                ));
            }
            self.connection
                .execute(
                    "INSERT INTO import_errors(job_id,code)VALUES(?1,?2)",
                    params![id, code],
                )
                .map_err(db_error)?;
        }
        Ok(())
    }
    pub fn metadata_set(
        &mut self,
        key: &str,
        value: &str,
        protector: &dyn Protector,
    ) -> CoreResult<()> {
        if value.len() > 4 * 1024 * 1024 {
            return Err(CoreError::new(
                "metadata_too_large",
                "Os detalhes da série excedem o limite de cache.",
            ));
        }
        self.connection
            .execute(
                "DELETE FROM metadata_cache WHERE expires_at<=unixepoch()",
                [],
            )
            .map_err(db_error)?;
        let sealed = protector.encrypt(value)?;
        self.connection.execute("INSERT INTO metadata_cache(cache_key,path,body,expires_at,size)VALUES(?1,'',?2,unixepoch()+3600,?3)ON CONFLICT(cache_key)DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at,size=excluded.size",params![key,sealed,sealed.len() as i64]).map_err(db_error)?;
        self.connection.execute("DELETE FROM metadata_cache WHERE cache_key IN (SELECT cache_key FROM metadata_cache ORDER BY expires_at DESC,cache_key LIMIT -1 OFFSET 256)",[]).map_err(db_error)?;
        while self
            .connection
            .query_row(
                "SELECT COALESCE(sum(size),0) FROM metadata_cache",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map_err(db_error)?
            > 32 * 1024 * 1024
        {
            self.connection.execute("DELETE FROM metadata_cache WHERE cache_key=(SELECT cache_key FROM metadata_cache ORDER BY expires_at,cache_key LIMIT 1)",[]).map_err(db_error)?;
        }
        Ok(())
    }
    pub fn metadata_get(&self, key: &str, protector: &dyn Protector) -> CoreResult<Option<String>> {
        let sealed: Option<Vec<u8>> = self
            .connection
            .query_row(
                "SELECT body FROM metadata_cache WHERE cache_key=?1 AND expires_at>unixepoch()",
                [key],
                |r| r.get(0),
            )
            .optional()
            .map_err(db_error)?
            .flatten();
        sealed
            .as_deref()
            .map(|data| protector.decrypt(data))
            .transpose()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    struct FixtureProtector;
    impl Protector for FixtureProtector {
        fn encrypt(&self, value: &str) -> CoreResult<Vec<u8>> {
            Ok(value.bytes().map(|b| b ^ 0x5a).collect())
        }
        fn decrypt(&self, value: &[u8]) -> CoreResult<String> {
            String::from_utf8(value.iter().map(|b| b ^ 0x5a).collect())
                .map_err(|_| CoreError::new("fixture", "Fixture inválida."))
        }
    }
    fn item(id: &str, name: &str) -> NormalizedItem {
        NormalizedItem {
            external_id: Some(id.into()),
            name: name.into(),
            kind: "live".into(),
            category: Some("Notícias".into()),
            stream_url: Some("https://example.org/stream?token=fixture-secret".into()),
            artwork_url: Some("https://example.org/logo?token=fixture-art".into()),
            ..Default::default()
        }
    }
    fn db() -> Database {
        let mut db = Database::memory().unwrap();
        db.save_source("one", "Origem um", "m3u", b"fixture-sealed")
            .unwrap();
        db.save_source("two", "Origem dois", "xtream", b"fixture-sealed")
            .unwrap();
        db
    }
    #[test]
    fn migration_pagination_identity_and_isolation() {
        let mut db = db();
        let flag = AtomicBool::new(false);
        let data = [
            item("a", "Mesmo nome"),
            item("b", "Mesmo nome"),
            item("a", "Mesmo nome"),
        ];
        let report = db
            .replace_catalog("one", &data, &FixtureProtector, &flag)
            .unwrap();
        assert_eq!(report.added, 3);
        db.replace_catalog("two", &[item("a", "Outro")], &FixtureProtector, &flag)
            .unwrap();
        let page = db
            .catalog(&CatalogQuery {
                source_id: Some("one".into()),
                limit: 2,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.items.len(), 2);
        assert_eq!(page.next_offset, Some(2));
        let tail = db
            .catalog(&CatalogQuery {
                source_id: Some("one".into()),
                offset: 2,
                limit: 2,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(tail.items.len(), 1);
        assert!(!page.items.iter().any(|i| i.id == tail.items[0].id));
        let ids: Vec<_> = page.items.iter().map(|i| i.id.clone()).collect();
        db.replace_catalog("one", &data, &FixtureProtector, &flag)
            .unwrap();
        assert_eq!(
            db.catalog(&CatalogQuery {
                source_id: Some("one".into()),
                limit: 2,
                ..Default::default()
            })
            .unwrap()
            .items
            .iter()
            .map(|i| i.id.clone())
            .collect::<Vec<_>>(),
            ids
        );
        assert_eq!(
            db.categories(Some("one"), Some("live")).unwrap(),
            vec!["Notícias"]
        );
        db.remove_source("one").unwrap();
        assert_eq!(
            db.catalog(&CatalogQuery {
                limit: 20,
                ..Default::default()
            })
            .unwrap()
            .total,
            1
        );
    }
    #[test]
    fn search_literals_and_missing_source() {
        let mut db = db();
        db.replace_catalog(
            "one",
            &[item("a", "100% real"), item("b", "Outro")],
            &FixtureProtector,
            &AtomicBool::new(false),
        )
        .unwrap();
        assert_eq!(
            db.catalog(&CatalogQuery {
                search: Some("%".into()),
                limit: 20,
                ..Default::default()
            })
            .unwrap()
            .total,
            1
        );
        assert_eq!(
            db.catalog(&CatalogQuery {
                search: Some("' OR 1=1 --".into()),
                limit: 20,
                ..Default::default()
            })
            .unwrap()
            .total,
            0
        );
        assert_eq!(
            db.replace_catalog(
                "missing",
                &[item("a", "x")],
                &FixtureProtector,
                &AtomicBool::new(false)
            )
            .err()
            .unwrap()
            .code,
            "source_missing"
        );
    }
    #[test]
    fn failed_refresh_and_cancel_preserve_previous_generation() {
        let mut db = db();
        let flag = AtomicBool::new(false);
        db.replace_catalog("one", &[item("old", "Anterior")], &FixtureProtector, &flag)
            .unwrap();
        struct CancelProtector<'a> {
            flag: &'a AtomicBool,
            count: AtomicUsize,
        }
        impl Protector for CancelProtector<'_> {
            fn encrypt(&self, s: &str) -> CoreResult<Vec<u8>> {
                if self.count.fetch_add(1, Ordering::Relaxed) > 1 {
                    self.flag.store(true, Ordering::Relaxed);
                }
                FixtureProtector.encrypt(s)
            }
            fn decrypt(&self, s: &[u8]) -> CoreResult<String> {
                FixtureProtector.decrypt(s)
            }
        }
        let cancel = CancelProtector {
            flag: &flag,
            count: AtomicUsize::new(0),
        };
        assert_eq!(
            db.replace_catalog(
                "one",
                &[item("new1", "Novo"), item("new2", "Novo")],
                &cancel,
                &flag
            )
            .err()
            .unwrap()
            .code,
            "cancelled"
        );
        let page = db
            .catalog(&CatalogQuery {
                limit: 20,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].name, "Anterior");
        flag.store(false, Ordering::Relaxed);
        assert_eq!(
            db.replace_catalog("one", &[], &FixtureProtector, &flag)
                .err()
                .unwrap()
                .code,
            "empty_playlist"
        );
        assert_eq!(
            db.catalog(&CatalogQuery {
                limit: 20,
                ..Default::default()
            })
            .unwrap()
            .items[0]
                .name,
            "Anterior"
        );
    }
    #[test]
    fn series_details_are_encrypted_scoped_and_atomic() {
        let mut db = db();
        let mut series = item("series-1", "Série");
        series.kind = "series".into();
        db.replace_catalog("one", &[series], &FixtureProtector, &AtomicBool::new(false))
            .unwrap();
        let id = db
            .catalog(&CatalogQuery {
                limit: 1,
                ..Default::default()
            })
            .unwrap()
            .items[0]
            .id
            .clone();
        let episode = NormalizedEpisode {
            external_id: "original-ep".into(),
            season: 2,
            name: "Episódio original".into(),
            stream_url: Some("https://example.org/series?token=episode-secret".into()),
            artwork_url: Some("https://example.org/poster?token=poster-secret".into()),
            ..Default::default()
        };
        db.replace_series_details(&id, std::slice::from_ref(&episode), &FixtureProtector)
            .unwrap();
        let encrypted: Vec<u8> = db
            .connection
            .query_row(
                "SELECT stream FROM episodes WHERE external_id='original-ep'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let episode_id = format!("{id}:2:original-ep:1");
        assert!(db
            .playback_url(&id, Some(&episode_id), &FixtureProtector)
            .unwrap()
            .contains("episode-secret"));
        assert!(db
            .playback_url("other-series", Some(&episode_id), &FixtureProtector)
            .is_err());
        assert!(db.playback_url(&id, None, &FixtureProtector).is_err());
        assert!(!String::from_utf8_lossy(&encrypted).contains("episode-secret"));
        assert!(FixtureProtector
            .decrypt(&encrypted)
            .unwrap()
            .contains("episode-secret"));
        struct FailedProtector;
        impl Protector for FailedProtector {
            fn encrypt(&self, _: &str) -> CoreResult<Vec<u8>> {
                Err(CoreError::new("storage", "Falha de armazenamento seguro."))
            }
            fn decrypt(&self, _: &[u8]) -> CoreResult<String> {
                Err(CoreError::new("storage", "Falha de armazenamento seguro."))
            }
        }
        assert!(db
            .replace_series_details(&id, &[episode], &FailedProtector)
            .is_err());
        assert_eq!(
            db.connection
                .query_row("SELECT count(*) FROM episodes", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
        db.remove_source("one").unwrap();
        assert_eq!(
            db.connection
                .query_row("SELECT count(*) FROM episodes", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn credentials_urls_and_metadata_never_plaintext_on_disk() {
        let path = std::env::temp_dir().join(format!("nova-core-{}.sqlite", uuid::Uuid::new_v4()));
        {
            let mut db = Database::open(&path).unwrap();
            let config = FixtureProtector
                .encrypt("{\"password\":\"fixture-password\"}")
                .unwrap();
            db.save_source("one", "Example", "xtream", &config).unwrap();
            db.replace_catalog(
                "one",
                &[item("a", "Demo")],
                &FixtureProtector,
                &AtomicBool::new(false),
            )
            .unwrap();
            db.metadata_set(
                "episodes",
                "https://example.org/?token=metadata-secret",
                &FixtureProtector,
            )
            .unwrap();
            assert!(db
                .metadata_get("episodes", &FixtureProtector)
                .unwrap()
                .unwrap()
                .contains("metadata-secret"));
            let page = db
                .catalog(&CatalogQuery {
                    limit: 1,
                    ..Default::default()
                })
                .unwrap();
            let dto = serde_json::to_string(&page).unwrap();
            assert!(!dto.contains("fixture-secret"));
            assert!(!dto.contains("https://"));
            assert_eq!(
                db.artwork_url(&page.items[0].id, &FixtureProtector)
                    .unwrap()
                    .as_deref(),
                Some("https://example.org/logo?token=fixture-art")
            );
        }
        let bytes = std::fs::read(&path).unwrap();
        let text = String::from_utf8_lossy(&bytes);
        for secret in [
            "fixture-password",
            "fixture-secret",
            "fixture-art",
            "metadata-secret",
        ] {
            assert!(!text.contains(secret));
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn jobs_are_persisted_and_interrupted_jobs_recovered() {
        let path = std::env::temp_dir().join(format!("nova-jobs-{}.sqlite", uuid::Uuid::new_v4()));
        {
            let mut db = Database::open(&path).unwrap();
            db.save_source("one", "Example", "m3u", b"sealed").unwrap();
            db.save_job("job", "one", "processing", 5, 1, None).unwrap();
        }
        let db = Database::open(&path).unwrap();
        let status: String = db
            .connection
            .query_row("SELECT status FROM import_jobs WHERE id='job'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(status, "failed");
        assert_eq!(db.sources().unwrap()[0].status, "failed");
        assert_eq!(
            db.connection
                .query_row(
                    "SELECT code FROM import_errors WHERE job_id='job'",
                    [],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            "interrupted"
        );
        drop(db);
        std::fs::remove_file(path).unwrap();
    }
}
