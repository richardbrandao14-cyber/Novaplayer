use super::{Result, ServiceError};
use futures_util::StreamExt;
use std::{
    net::IpAddr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use url::Url;

#[derive(Clone)]
pub struct HttpClient {
    client: reqwest::Client,
    pub max_bytes: usize,
}
impl HttpClient {
    pub fn new(max_bytes: usize) -> Result<Self> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .user_agent("NOVA-PLAYER/0.1")
            .build()
            .map_err(|_| ServiceError::new("network", "Não foi possível preparar a conexão."))?;
        Ok(Self { client, max_bytes })
    }
    pub fn validate_url(value: &str) -> Result<Url> {
        let url = Url::parse(value)
            .map_err(|_| ServiceError::new("url", "Informe uma URL HTTP ou HTTPS válida."))?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || value.len() > 4096
        {
            return Err(ServiceError::new(
                "url",
                "URL inválida ou com credenciais embutidas.",
            ));
        }
        Ok(url)
    }
    pub async fn bytes(&self, url: Url, cancel: Arc<AtomicBool>) -> Result<Vec<u8>> {
        self.fetch(url, cancel, false).await.map(|v| v.0)
    }
    pub async fn image(&self, url: Url, cancel: Arc<AtomicBool>) -> Result<(Vec<u8>, String)> {
        self.fetch(url, cancel, true).await
    }
    async fn fetch(
        &self,
        mut url: Url,
        cancel: Arc<AtomicBool>,
        image: bool,
    ) -> Result<(Vec<u8>, String)> {
        let origin = url.origin();
        for _ in 0..=3 {
            if cancel.load(Ordering::Relaxed) {
                return Err(ServiceError::cancelled());
            }
            let client = if image {
                if url.scheme() != "https" {
                    return Err(ServiceError::new("image", "Imagem remota indisponível."));
                }
                let host = url
                    .host_str()
                    .ok_or_else(|| ServiceError::new("image", "Imagem remota indisponível."))?;
                let port = url.port_or_known_default().unwrap_or(443);
                let resolved = tokio::select! {value=tokio::time::timeout(Duration::from_secs(10),tokio::net::lookup_host((host,port)))=>value.map_err(|_|ServiceError::new("timeout","A consulta de imagem excedeu o limite."))?.map_err(|_|ServiceError::new("image","Não foi possível localizar a imagem."))?,_=wait_cancel(cancel.clone())=>return Err(ServiceError::cancelled())};
                let addresses = resolved.collect::<Vec<_>>();
                if addresses.is_empty() || addresses.iter().any(|v| !is_public(v.ip())) {
                    return Err(ServiceError::new(
                        "image",
                        "Destino de imagem não permitido.",
                    ));
                }
                reqwest::Client::builder()
                    .redirect(reqwest::redirect::Policy::none())
                    .no_proxy()
                    .resolve_to_addrs(host, &addresses)
                    .connect_timeout(Duration::from_secs(10))
                    .timeout(Duration::from_secs(30))
                    .build()
                    .map_err(|_| ServiceError::new("image", "Imagem indisponível."))?
            } else {
                self.client.clone()
            };
            let response = tokio::select! {value=client.get(url.clone()).send()=>value.map_err(network_error)?,_=wait_cancel(cancel.clone())=>return Err(ServiceError::cancelled())};
            if response.status().is_redirection() {
                let location = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .ok_or_else(|| ServiceError::new("redirect", "Redirecionamento inválido."))?;
                let next = url
                    .join(location)
                    .map_err(|_| ServiceError::new("redirect", "Redirecionamento inválido."))?;
                Self::validate_url(next.as_str())?;
                if !image && next.origin() != origin {
                    return Err(ServiceError::new(
                        "redirect",
                        "O servidor redirecionou para outro destino. Cadastre a origem correta.",
                    ));
                }
                if url.scheme() == "https" && next.scheme() != "https" {
                    return Err(ServiceError::new(
                        "redirect",
                        "Redirecionamento inseguro bloqueado.",
                    ));
                }
                url = next;
                continue;
            }
            match response.status().as_u16() {
                401 | 403 => {
                    return Err(ServiceError::new(
                        "authentication",
                        "Acesso negado. Verifique as credenciais e a autorização da fonte.",
                    ))
                }
                404 => {
                    return Err(ServiceError::new(
                        "not_found",
                        "A fonte não foi encontrada no servidor.",
                    ))
                }
                n if n >= 400 => {
                    return Err(ServiceError::new(
                        "http",
                        "O servidor respondeu com erro. Tente novamente mais tarde.",
                    ))
                }
                _ => {}
            }
            if response
                .content_length()
                .is_some_and(|size| size > self.max_bytes as u64)
            {
                return Err(ServiceError::new(
                    "too_large",
                    "A resposta excede o limite de tamanho.",
                ));
            }
            let mime = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .split(';')
                .next()
                .unwrap_or("")
                .to_string();
            let mut body = Vec::new();
            let mut stream = response.bytes_stream();
            loop {
                let next = tokio::select! {v=stream.next()=>v,_=wait_cancel(cancel.clone())=>return Err(ServiceError::cancelled())};
                match next {
                    None => break,
                    Some(Err(error)) => return Err(network_error(error)),
                    Some(Ok(chunk)) => {
                        if body.len().saturating_add(chunk.len()) > self.max_bytes {
                            return Err(ServiceError::new(
                                "too_large",
                                "A resposta excede o limite de tamanho.",
                            ));
                        }
                        body.extend_from_slice(&chunk);
                    }
                }
            }
            return Ok((body, mime));
        }
        Err(ServiceError::new(
            "redirect",
            "O servidor excedeu o limite de redirecionamentos.",
        ))
    }
}
fn network_error(error: reqwest::Error) -> ServiceError {
    if error.is_timeout() {
        ServiceError::new(
            "timeout",
            "O servidor demorou além do limite. Tente novamente.",
        )
    } else {
        ServiceError::new("network", "Não foi possível conectar ao servidor.")
    }
}
pub async fn wait_cancel(cancel: Arc<AtomicBool>) {
    while !cancel.load(Ordering::Relaxed) {
        tokio::time::sleep(Duration::from_millis(40)).await;
    }
}
fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => {
            !v.is_private()
                && !v.is_loopback()
                && !v.is_link_local()
                && !v.is_broadcast()
                && !v.is_documentation()
                && !v.is_unspecified()
                && !v.is_multicast()
                && v.octets()[0] != 0
                && v.octets()[0] < 224
                && !(v.octets()[0] == 100 && (64..=127).contains(&v.octets()[1]))
        }
        IpAddr::V6(v) => {
            if let Some(v4) = v.to_ipv4_mapped() {
                return is_public(IpAddr::V4(v4));
            }
            let segments = v.segments();
            (segments[0] & 0xe000) == 0x2000
                && !v.is_loopback()
                && !v.is_unspecified()
                && !v.is_multicast()
                && (segments[0] != 0x2001 || segments[1] != 0xdb8)
                && segments[0] != 0x2002
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unsafe_urls_and_addresses() {
        for url in [
            "file:///secret",
            "javascript:bad",
            "https://name:password@example.com",
        ] {
            assert!(HttpClient::validate_url(url).is_err());
        }
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!is_public(ip.parse().unwrap()));
        }
        assert!(is_public("8.8.8.8".parse().unwrap()));
    }
}
