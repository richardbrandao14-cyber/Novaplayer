//! Independent protocol tests: all credentials and hosts are local fixtures.
use nova_player_lib::services::http::HttpClient;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    task::JoinHandle,
};
use url::Url;

async fn fixture(response: Vec<u8>, delay: Duration) -> (Url, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0u8; 16384];
        let _ = socket.read(&mut request).await;
        tokio::time::sleep(delay).await;
        let _ = socket.write_all(&response).await;
        let _ = socket.shutdown().await;
    });
    (
        Url::parse(&format!(
            "http://{address}/playlist?token=fixture-private-token"
        ))
        .unwrap(),
        handle,
    )
}

#[tokio::test]
async fn successful_explicit_source_returns_bytes_without_following_content_links() {
    let body = b"#EXTM3U\n#EXTINF:-1,Original\nhttps://example.org/video\n";
    let mut response = format!(
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    response.extend_from_slice(body);
    let (url, server) = fixture(response, Duration::ZERO).await;
    let bytes = HttpClient::new(1024)
        .unwrap()
        .bytes(url, Arc::new(AtomicBool::new(false)))
        .await
        .unwrap();
    assert_eq!(bytes, body);
    server.await.unwrap();
}

#[tokio::test]
async fn cross_origin_redirect_never_forwards_the_credential_query() {
    let destination = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = destination.local_addr().unwrap();
    let response = format!("HTTP/1.1 302 Found\r\nLocation: http://{address}/capture\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").into_bytes();
    let (url, server) = fixture(response, Duration::ZERO).await;
    let error = HttpClient::new(1024)
        .unwrap()
        .bytes(url, Arc::new(AtomicBool::new(false)))
        .await
        .unwrap_err();
    assert_eq!(error.code, "redirect");
    assert!(!error.message.contains("fixture-private-token"));
    assert!(
        tokio::time::timeout(Duration::from_millis(100), destination.accept())
            .await
            .is_err()
    );
    server.await.unwrap();
}

#[tokio::test]
async fn declared_and_streamed_oversize_bodies_are_bounded() {
    for response in [
        b"HTTP/1.1 200 OK\r\nContent-Length: 999999\r\nConnection: close\r\n\r\n".to_vec(),
        [
            b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n".as_slice(),
            &[b'x'; 256],
        ]
        .concat(),
    ] {
        let (url, server) = fixture(response, Duration::ZERO).await;
        let error = HttpClient::new(32)
            .unwrap()
            .bytes(url, Arc::new(AtomicBool::new(false)))
            .await
            .unwrap_err();
        assert_eq!(error.code, "too_large");
        server.await.unwrap();
    }
}

#[tokio::test]
async fn cancellation_interrupts_a_stalled_request_without_waiting_for_server() {
    let (url, server) = fixture(
        b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n".to_vec(),
        Duration::from_secs(5),
    )
    .await;
    let cancelled = Arc::new(AtomicBool::new(false));
    let cancellation_signal = cancelled.clone();
    let request =
        tokio::spawn(async move { HttpClient::new(1024).unwrap().bytes(url, cancelled).await });
    tokio::time::sleep(Duration::from_millis(50)).await;
    cancellation_signal.store(true, Ordering::Relaxed);
    let error = tokio::time::timeout(Duration::from_secs(1), request)
        .await
        .unwrap()
        .unwrap()
        .unwrap_err();
    assert_eq!(error.code, "cancelled");
    server.abort();
}

#[tokio::test]
async fn authentication_errors_are_sanitized_not_provider_body_or_sensitive_url() {
    let response = b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 25\r\nConnection: close\r\n\r\nprovider-sensitive-token".to_vec();
    let (url, server) = fixture(response, Duration::ZERO).await;
    let error = HttpClient::new(1024)
        .unwrap()
        .bytes(url, Arc::new(AtomicBool::new(false)))
        .await
        .unwrap_err();
    assert_eq!(error.code, "authentication");
    let public = serde_json::to_string(&error).unwrap();
    for forbidden in [
        "fixture-private-token",
        "provider-sensitive-token",
        "127.0.0.1",
    ] {
        assert!(!public.contains(forbidden));
    }
    server.await.unwrap();
}
