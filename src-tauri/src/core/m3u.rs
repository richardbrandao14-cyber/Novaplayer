use super::{
    error::{CoreError, CoreResult},
    models::{ImportReport, NormalizedItem},
};
use std::{
    collections::HashMap,
    io::{BufRead, Cursor},
    sync::atomic::{AtomicBool, Ordering},
};

#[derive(Clone, Copy)]
pub struct ParseLimits {
    pub max_bytes: usize,
    pub max_records: usize,
    pub max_line_bytes: usize,
}
impl Default for ParseLimits {
    fn default() -> Self {
        Self {
            max_bytes: 64 * 1024 * 1024,
            max_records: 100_000,
            max_line_bytes: 64 * 1024,
        }
    }
}
pub struct ParsedPlaylist {
    pub items: Vec<NormalizedItem>,
    pub report: ImportReport,
}
fn fail(code: &str, message: &str) -> CoreError {
    CoreError::new(code, message)
}
fn valid_url(value: &str) -> bool {
    url::Url::parse(value)
        .is_ok_and(|u| matches!(u.scheme(), "https" | "http") && u.host_str().is_some())
}

pub fn parse_bytes(
    bytes: &[u8],
    limits: &ParseLimits,
    cancel: &AtomicBool,
) -> CoreResult<ParsedPlaylist> {
    if bytes.len() > limits.max_bytes {
        return Err(fail("too_large", "A playlist excede o tamanho permitido."));
    }
    if cancel.load(Ordering::Relaxed) {
        return Err(CoreError::cancelled());
    }
    let (text, legacy) = if let Some(body) = bytes.strip_prefix(&[0xff, 0xfe]) {
        let (s, _, errors) = encoding_rs::UTF_16LE.decode(body);
        if errors {
            return Err(fail("encoding", "A codificação da playlist é inválida."));
        }
        (s.into_owned(), false)
    } else if let Some(body) = bytes.strip_prefix(&[0xfe, 0xff]) {
        let (s, _, errors) = encoding_rs::UTF_16BE.decode(body);
        if errors {
            return Err(fail("encoding", "A codificação da playlist é inválida."));
        }
        (s.into_owned(), false)
    } else {
        let body = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
        match std::str::from_utf8(body) {
            Ok(s) => (s.to_owned(), false),
            Err(_) => {
                let (s, _, errors) = encoding_rs::WINDOWS_1252.decode(body);
                if errors {
                    return Err(fail("encoding", "A codificação da playlist é inválida."));
                }
                (s.into_owned(), true)
            }
        }
    };
    let mut result = parse_reader(Cursor::new(text.as_bytes()), limits, cancel)?;
    if legacy {
        result
            .report
            .warnings
            .push("Codificação Windows-1252 utilizada; revise nomes importados.".into());
    }
    Ok(result)
}

// Streaming UTF-8 parser: one bounded line at a time; never logs provider data.
pub fn parse_reader<R: BufRead>(
    mut reader: R,
    limits: &ParseLimits,
    cancel: &AtomicBool,
) -> CoreResult<ParsedPlaylist> {
    let mut items = Vec::new();
    let mut report = ImportReport::default();
    let mut pending: Option<(String, HashMap<String, String>)> = None;
    let mut header = false;
    let mut consumed = 0usize;
    let mut line = Vec::new();
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::cancelled());
        }
        line.clear();
        // take caps read allocation even for a malicious single line.
        let n = std::io::Read::take(&mut reader, (limits.max_line_bytes + 2) as u64)
            .read_until(b'\n', &mut line)
            .map_err(|_| fail("read", "Não foi possível ler a playlist."))?;
        if n == 0 {
            break;
        }
        consumed = consumed.saturating_add(n);
        if consumed > limits.max_bytes {
            return Err(fail("too_large", "A playlist excede o tamanho permitido."));
        }
        if line.len() > limits.max_line_bytes {
            return Err(fail(
                "line_too_large",
                "Uma linha da playlist excede o limite permitido.",
            ));
        }
        let s = std::str::from_utf8(&line)
            .map_err(|_| fail("encoding", "A codificação da playlist é inválida."))?
            .trim()
            .trim_start_matches('\u{feff}');
        if s.is_empty() {
            continue;
        }
        if s.starts_with("#EXT-X-") {
            return Err(fail(
                "hls_manifest",
                "Este arquivo é um manifesto HLS de reprodução, não um catálogo IPTV.",
            ));
        }
        if s.starts_with("#EXTM3U") {
            header = true;
            continue;
        }
        if let Some(info) = s.strip_prefix("#EXTINF:") {
            if pending.take().is_some() {
                report.invalid += 1;
            }
            let (attributes, title) = split_info(info);
            pending = Some((title.to_owned(), parse_attributes(attributes)));
            continue;
        }
        if s.starts_with('#') {
            continue;
        }
        if !header {
            return Err(fail(
                "malformed",
                "Não foi encontrada a diretiva #EXTM3U da playlist.",
            ));
        }
        let metadata = pending.take();
        if !valid_url(s) {
            report.invalid += 1;
            continue;
        }
        if items.len() >= limits.max_records {
            return Err(fail(
                "too_many_records",
                "A playlist excede a quantidade permitida de registros.",
            ));
        }
        let (title, attrs) = metadata.unwrap_or_default();
        let logo = attrs
            .get("tvg-logo")
            .filter(|value| valid_url(value))
            .cloned();
        let name = if title.trim().is_empty() {
            attrs.get("tvg-name").cloned().unwrap_or_default()
        } else {
            title.trim().to_owned()
        };
        items.push(NormalizedItem {
            external_id: attrs.get("tvg-id").filter(|v| !v.is_empty()).cloned(),
            name,
            kind: "unknown".into(),
            category: attrs.get("group-title").filter(|v| !v.is_empty()).cloned(),
            stream_url: Some(s.to_owned()),
            artwork_url: logo,
            ..Default::default()
        });
        report.valid += 1;
    }
    if pending.is_some() {
        report.invalid += 1;
    }
    if !header {
        return Err(fail(
            "malformed",
            "Não foi encontrada a diretiva #EXTM3U da playlist.",
        ));
    }
    if items.is_empty() {
        return Err(fail(
            "empty_playlist",
            "A playlist não contém registros válidos.",
        ));
    }
    if report.invalid > 0 {
        report.warnings.push(
            "Alguns registros inválidos foram ignorados; os registros válidos foram preservados."
                .into(),
        );
    }
    report.warnings.push(
        "M3U sem classificação explícita: itens importados como conteúdo não classificado.".into(),
    );
    Ok(ParsedPlaylist { items, report })
}
fn split_info(value: &str) -> (&str, &str) {
    let mut quote = None;
    for (i, c) in value.char_indices() {
        if matches!(c, '\"' | '\'') {
            if quote == Some(c) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(c);
            }
        } else if c == ',' && quote.is_none() {
            return (&value[..i], &value[i + 1..]);
        }
    }
    (value, "")
}
fn parse_attributes(value: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let chars = value.as_bytes();
    let mut i = 0;
    while i < chars.len() {
        while i < chars.len() && chars[i].is_ascii_whitespace() {
            i += 1;
        }
        let start = i;
        while i < chars.len() && !chars[i].is_ascii_whitespace() && chars[i] != b'=' {
            i += 1;
        }
        let key = &value[start..i];
        let key_end = i;
        while i < chars.len() && chars[i].is_ascii_whitespace() {
            i += 1;
        }
        if i >= chars.len() || chars[i] != b'=' {
            i = key_end;
            continue;
        }
        i += 1;
        while i < chars.len() && chars[i].is_ascii_whitespace() {
            i += 1;
        }
        if i >= chars.len() {
            break;
        }
        let quote = chars[i];
        let quoted = quote == b'\"' || quote == b'\'';
        if quoted {
            i += 1;
        }
        let begin = i;
        while i < chars.len()
            && if quoted {
                chars[i] != quote
            } else {
                !chars[i].is_ascii_whitespace()
            }
        {
            i += 1;
        }
        let text = &value[begin..i];
        if !key.is_empty() {
            out.insert(key.to_ascii_lowercase(), text.to_owned());
        }
        if quoted && i < chars.len() {
            i += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unicode_missing_and_invalid() {
        let text="#EXTM3U\n#EXTINF:-1 tvg-id=\"c1\" tvg-name=\"São João\" group-title=\"Música, Brasil\" tvg-logo=\"https://example.org/logo.png\",São João, ao vivo\nhttps://example.org/stream?token=fixture-secret\n#EXTINF:-1,Quebrado\njavascript:bad\n#EXTINF:-1 tvg-name=\"Nome original\",\nhttps://example.org/other\n";
        let parsed = parse_bytes(
            text.as_bytes(),
            &ParseLimits::default(),
            &AtomicBool::new(false),
        )
        .unwrap();
        assert_eq!(parsed.items.len(), 2);
        assert_eq!(parsed.items[0].name, "São João, ao vivo");
        assert_eq!(parsed.items[0].category.as_deref(), Some("Música, Brasil"));
        assert_eq!(parsed.items[0].external_id.as_deref(), Some("c1"));
        assert_eq!(parsed.items[1].name, "Nome original");
        assert_eq!(parsed.report.invalid, 1);
        assert!(!serde_json::to_string(&parsed.report)
            .unwrap()
            .contains("fixture-secret"));
    }
    #[test]
    fn rejects_hls_empty_oversize_and_cancel() {
        let flag = AtomicBool::new(false);
        assert_eq!(
            parse_bytes(
                b"#EXTM3U\n#EXT-X-TARGETDURATION:10\nsegment.ts",
                &ParseLimits::default(),
                &flag
            )
            .err()
            .unwrap()
            .code,
            "hls_manifest"
        );
        assert_eq!(
            parse_bytes(b"#EXTM3U\n", &ParseLimits::default(), &flag)
                .err()
                .unwrap()
                .code,
            "empty_playlist"
        );
        let limits = ParseLimits {
            max_line_bytes: 8,
            ..Default::default()
        };
        assert_eq!(
            parse_bytes(b"#EXTM3U\nhttps://example.com/long", &limits, &flag)
                .err()
                .unwrap()
                .code,
            "line_too_large"
        );
        flag.store(true, Ordering::Relaxed);
        assert_eq!(
            parse_bytes(b"", &ParseLimits::default(), &flag)
                .err()
                .unwrap()
                .code,
            "cancelled"
        );
    }
    #[test]
    fn encodings() {
        let utf16: Vec<u8> = [0xff, 0xfe]
            .into_iter()
            .chain(
                "#EXTM3U\n#EXTINF:-1,João\nhttps://example.org/a\n"
                    .encode_utf16()
                    .flat_map(u16::to_le_bytes),
            )
            .collect();
        assert_eq!(
            parse_bytes(&utf16, &ParseLimits::default(), &AtomicBool::new(false))
                .unwrap()
                .items[0]
                .name,
            "João"
        );
        let bytes = b"#EXTM3U\n#EXTINF:-1,Caf\xe9\nhttps://example.org/a\n";
        let parsed = parse_bytes(bytes, &ParseLimits::default(), &AtomicBool::new(false)).unwrap();
        assert_eq!(parsed.items[0].name, "Café");
        assert!(parsed.report.warnings.iter().any(|w| w.contains("1252")));
    }
}
