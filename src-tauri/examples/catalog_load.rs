//! Synthetic, non-network benchmark. Fixture obfuscation is NOT production security.
use nova_player_lib::core::{
    db::{Database, Protector},
    error::CoreResult,
    m3u::{parse_bytes, ParseLimits},
    models::CatalogQuery,
};
use std::{sync::atomic::AtomicBool, time::Instant};
struct FixtureOnly;
impl Protector for FixtureOnly {
    fn encrypt(&self, s: &str) -> CoreResult<Vec<u8>> {
        Ok(s.bytes().map(|b| b ^ 0x5a).collect())
    }
    fn decrypt(&self, b: &[u8]) -> CoreResult<String> {
        Ok(b.iter().map(|b| char::from(b ^ 0x5a)).collect())
    }
}
fn main() {
    let n = std::env::args()
        .nth(1)
        .unwrap_or("1000".into())
        .parse::<usize>()
        .expect("numeric fixture count");
    assert!([1000, 10000, 30000, 50000].contains(&n));
    let mut input = String::from("#EXTM3U\n");
    for i in 0..n {
        input.push_str(&format!("#EXTINF:-1 tvg-id=\"{i}\" group-title=\"Grupo {}\",Canal {i}\nhttps://example.invalid/fixture/{i}?token=synthetic\n",i%20));
    }
    let flag = AtomicBool::new(false);
    let start = Instant::now();
    let parsed = parse_bytes(input.as_bytes(), &ParseLimits::default(), &flag).expect("parse");
    let parse_ms = start.elapsed().as_secs_f64() * 1000.;
    let mut db = Database::memory().expect("db");
    db.save_source("fixture", "Synthetic fixture", "m3u", b"fixture-sealed")
        .expect("source");
    let start = Instant::now();
    db.replace_catalog("fixture", &parsed.items, &FixtureOnly, &flag)
        .expect("import");
    let import_ms = start.elapsed().as_secs_f64() * 1000.;
    let start = Instant::now();
    let page = db
        .catalog(&CatalogQuery {
            source_id: Some("fixture".into()),
            limit: 100,
            search: Some("Canal 1".into()),
            ..Default::default()
        })
        .expect("query");
    let query_ms = start.elapsed().as_secs_f64() * 1000.;
    assert_eq!(parsed.items.len(), n);
    assert!(page.items.len() <= 100);
    let start = Instant::now();
    assert!(db
        .replace_catalog(
            "fixture",
            &parsed.items,
            &FixtureOnly,
            &AtomicBool::new(true)
        )
        .is_err());
    let cancel_ms = start.elapsed().as_secs_f64() * 1000.;
    assert_eq!(
        db.catalog(&CatalogQuery {
            limit: 1,
            ..Default::default()
        })
        .unwrap()
        .total,
        n as u64
    );
    println!("{{\"records\":{n},\"inputBytes\":{},\"parseMs\":{parse_ms:.3},\"importMs\":{import_ms:.3},\"queryMs\":{query_ms:.3},\"cancelMs\":{cancel_ms:.3},\"queryMatches\":{},\"returned\":{}}}",input.len(),page.total,page.items.len());
}
