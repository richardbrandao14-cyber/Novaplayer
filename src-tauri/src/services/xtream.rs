use super::{http::HttpClient, Result, ServiceError};
use crate::core::models::{NormalizedEpisode, NormalizedItem};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub local_path: Option<String>,
}
pub struct XtreamClient {
    http: HttpClient,
    config: SourceConfig,
}
impl XtreamClient {
    pub fn new(http: HttpClient, config: SourceConfig) -> Self {
        Self { http, config }
    }
    async fn api(
        &self,
        action: Option<&str>,
        extra: Option<(&str, &str)>,
        cancel: Arc<AtomicBool>,
    ) -> Result<Value> {
        let mut url = HttpClient::validate_url(&self.config.url)?;
        let base_path = url.path().trim_end_matches('/').to_owned();
        url.set_path(&format!("{base_path}/player_api.php"));
        url.set_query(None);
        {
            let mut query = url.query_pairs_mut();
            query
                .append_pair("username", &self.config.username)
                .append_pair("password", &self.config.password);
            if let Some(action) = action {
                query.append_pair("action", action);
            }
            if let Some((key, value)) = extra {
                query.append_pair(key, value);
            }
        }
        let bytes = self.http.bytes(url, cancel).await?;
        tokio::task::spawn_blocking(move || {
            serde_json::from_slice(&bytes).map_err(|_| {
                ServiceError::new("provider", "O provedor retornou dados inesperados.")
            })
        })
        .await
        .map_err(|_| {
            ServiceError::new(
                "processing",
                "Não foi possível processar os dados do provedor.",
            )
        })?
    }
    pub async fn authenticate(&self, cancel: Arc<AtomicBool>) -> Result<()> {
        let response = self.api(None, None, cancel).await?;
        let user = response.get("user_info").ok_or_else(|| {
            ServiceError::new("provider", "O provedor não informou a situação da conta.")
        })?;
        let auth = if user.get("auth").and_then(Value::as_bool) == Some(true) {
            Some("1".into())
        } else {
            field(user, "auth")
        };
        let status = field(user, "status");
        if auth.as_deref() != Some("1")
            || status
                .as_deref()
                .is_some_and(|v| !v.eq_ignore_ascii_case("active"))
        {
            return Err(ServiceError::new(
                "authentication",
                "Credenciais incorretas ou conta sem autorização ativa.",
            ));
        }
        Ok(())
    }
    pub async fn catalog(
        &self,
        cancel: Arc<AtomicBool>,
        mut progress: impl FnMut(&str, usize),
    ) -> Result<(Vec<NormalizedItem>, usize)> {
        let mut all = Vec::new();
        let mut invalid = 0;
        for (kind, category_action, list_action, id_key, cover_key) in [
            (
                "live",
                "get_live_categories",
                "get_live_streams",
                "stream_id",
                "stream_icon",
            ),
            (
                "movie",
                "get_vod_categories",
                "get_vod_streams",
                "stream_id",
                "stream_icon",
            ),
            (
                "series",
                "get_series_categories",
                "get_series",
                "series_id",
                "cover",
            ),
        ] {
            if cancel.load(Ordering::Relaxed) {
                return Err(ServiceError::cancelled());
            }
            let categories_response = self
                .api(Some(category_action), None, cancel.clone())
                .await?;
            let mut categories = HashMap::new();
            for value in categories_response
                .as_array()
                .ok_or_else(|| ServiceError::new("provider", "Categorias em formato inesperado."))?
            {
                if let (Some(id), Some(name)) =
                    (field(value, "category_id"), field(value, "category_name"))
                {
                    categories.insert(id, name);
                }
            }
            progress("downloading", all.len());
            let response = self.api(Some(list_action), None, cancel.clone()).await?;
            let entries = response
                .as_array()
                .ok_or_else(|| ServiceError::new("provider", "Catálogo em formato inesperado."))?;
            for entry in entries {
                if cancel.load(Ordering::Relaxed) {
                    return Err(ServiceError::cancelled());
                }
                let name = field(entry, "name").unwrap_or_default();
                let Some(id) = field(entry, id_key) else {
                    invalid += 1;
                    continue;
                };
                let stream = if kind == "series" {
                    None
                } else {
                    Some(
                        self.stream_url(
                            kind,
                            &id,
                            field(entry, "container_extension")
                                .as_deref()
                                .unwrap_or(if kind == "live" { "ts" } else { "mp4" }),
                        )?,
                    )
                };
                let category =
                    field(entry, "category_id").and_then(|id| categories.get(&id).cloned());
                all.push(NormalizedItem {
                    external_id: Some(id),
                    name,
                    kind: kind.into(),
                    category,
                    stream_url: stream,
                    artwork_url: field(entry, cover_key)
                        .filter(|v| HttpClient::validate_url(v).is_ok()),
                    description: field(entry, "plot"),
                    year: field(entry, "year"),
                    duration: field(entry, "duration"),
                    rating: field(entry, "rating"),
                });
                if all.len() > 100_000 {
                    return Err(ServiceError::new(
                        "too_large",
                        "O catálogo excedeu o limite de registros.",
                    ));
                }
            }
            progress("processing", all.len());
        }
        Ok((all, invalid))
    }
    fn stream_url(&self, kind: &str, id: &str, extension: &str) -> Result<String> {
        let mut url = HttpClient::validate_url(&self.config.url)?;
        url.set_query(None);
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| ServiceError::new("url", "Servidor inválido."))?;
        segments
            .pop_if_empty()
            .push(match kind {
                "live" => "live",
                "series" => "series",
                _ => "movie",
            })
            .push(&self.config.username)
            .push(&self.config.password)
            .push(&format!("{id}.{extension}"));
        drop(segments);
        Ok(url.into())
    }
    pub async fn series(
        &self,
        id: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<(Vec<SeasonDto>, Vec<NormalizedEpisode>)> {
        let response = self
            .api(Some("get_series_info"), Some(("series_id", id)), cancel)
            .await?;
        let Some(groups) = response.get("episodes").and_then(Value::as_object) else {
            return Ok((Vec::new(), Vec::new()));
        };
        let mut normalized = Vec::new();
        let mut seasons = Vec::new();
        for (number, values) in groups {
            let Some(values) = values.as_array() else {
                continue;
            };
            let mut episodes = Vec::new();
            for value in values {
                let Some(id) = field(value, "id") else {
                    continue;
                };
                let title = field(value, "title")
                    .or_else(|| field(value, "name"))
                    .unwrap_or_default();
                let info = value.get("info").unwrap_or(value);
                normalized.push(NormalizedEpisode {
                    external_id: id.clone(),
                    season: number.parse().unwrap_or(0),
                    name: title.clone(),
                    description: field(info, "plot"),
                    duration: field(info, "duration"),
                    artwork_url: field(info, "movie_image")
                        .filter(|v| HttpClient::validate_url(v).is_ok()),
                    stream_url: field(value, "direct_source")
                        .filter(|v| HttpClient::validate_url(v).is_ok())
                        .or_else(|| {
                            self.stream_url(
                                "series",
                                &id,
                                field(value, "container_extension")
                                    .as_deref()
                                    .unwrap_or("mp4"),
                            )
                            .ok()
                        }),
                });
                episodes.push(EpisodeDto {
                    id,
                    title,
                    description: field(info, "plot").unwrap_or_default(),
                    artwork: String::new(),
                    duration: field(info, "duration").unwrap_or_default(),
                });
            }
            seasons.push(SeasonDto {
                id: number.clone(),
                number: number.parse().unwrap_or(0),
                episodes,
            });
        }
        seasons.sort_by_key(|s| s.number);
        Ok((seasons, normalized))
    }
}
pub fn field(value: &Value, key: &str) -> Option<String> {
    match value.get(key)? {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub artwork: String,
    pub duration: String,
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonDto {
    pub id: String,
    pub number: u32,
    pub episodes: Vec<EpisodeDto>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn optional_provider_fields_are_tolerant() {
        let value = serde_json::json!({"stream_id":42,"name":null});
        assert_eq!(field(&value, "stream_id"), Some("42".into()));
        assert_eq!(field(&value, "name"), None);
    }
    #[test]
    fn secret_path_is_encoded_not_concatenated() {
        let config = SourceConfig {
            url: "https://example.com".into(),
            username: "user/name".into(),
            password: "x?y".into(),
            local_path: None,
        };
        let client = XtreamClient::new(HttpClient::new(1024).unwrap(), config);
        let url = client.stream_url("live", "3", "ts").unwrap();
        assert!(url.contains("user%2Fname"));
        assert!(url.contains("x%3Fy"));
    }
}
