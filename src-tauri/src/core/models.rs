use serde::{Deserialize, Serialize};

// Deliberately no Debug/Serialize: provider URLs and opaque credentials stay native.
#[derive(Clone, Default)]
pub struct NormalizedItem {
    pub external_id: Option<String>,
    pub name: String,
    pub kind: String,
    pub category: Option<String>,
    pub stream_url: Option<String>,
    pub artwork_url: Option<String>,
    pub description: Option<String>,
    pub year: Option<String>,
    pub duration: Option<String>,
    pub rating: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDto {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub status: String,
    pub item_count: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogItem {
    pub id: String,
    pub source_id: String,
    pub external_id: Option<String>,
    pub name: String,
    pub kind: String,
    pub category: Option<String>,
    pub has_artwork: bool,
    pub favorite: bool,
    pub watchlist: bool,
    pub description: Option<String>,
    pub year: Option<String>,
    pub duration: Option<String>,
    pub rating: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CatalogQuery {
    pub source_id: Option<String>,
    pub kind: Option<String>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub offset: u32,
    pub limit: u32,
    pub sort: Option<String>,
    pub collection: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPage {
    pub items: Vec<CatalogItem>,
    pub total: u64,
    pub next_offset: Option<u32>,
}
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub valid: u64,
    pub invalid: u64,
    pub warnings: Vec<String>,
    pub added: u64,
    pub removed: u64,
}

#[derive(Clone, Default)]
pub struct NormalizedEpisode {
    pub external_id: String,
    pub season: u32,
    pub name: String,
    pub description: Option<String>,
    pub duration: Option<String>,
    pub stream_url: Option<String>,
    pub artwork_url: Option<String>,
}

#[derive(Clone, Default, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryState {
    pub favorite: bool,
    pub watchlist: bool,
    pub position: f64,
    pub duration: f64,
    pub episode_id: Option<String>,
}
