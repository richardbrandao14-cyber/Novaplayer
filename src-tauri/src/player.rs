//! FFI libmpv isolada: um único trabalhador possui a DLL e o handle.
//! Nunca encaminha URL, eventos brutos ou logs do motor à interface.
use crate::services::{Result, ServiceError};
use std::{
    ffi::{c_char, c_int, c_void, CStr, CString},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};
use tokio::sync::oneshot;
fn error() -> ServiceError {
    ServiceError::new("playback", "Não foi possível reproduzir esta mídia.")
}
#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
    pub state: String,
    pub position: f64,
    pub duration: f64,
    pub volume: f64,
    pub paused: bool,
    pub muted: bool,
    pub seekable: bool,
    pub speed: f64,
    pub tracks: Vec<Track>,
    pub error: Option<&'static str>,
}
#[derive(Clone, serde::Serialize)]
pub struct Track {
    pub id: i64,
    pub kind: String,
    pub label: String,
    pub selected: bool,
}
#[derive(serde::Deserialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum Control {
    Pause(bool),
    Volume(f64),
    Mute(bool),
    Seek(f64),
    Speed(f64),
    Audio(i64),
    Subtitle(i64),
    Fullscreen(bool),
    Stop,
}
enum Request {
    Load(String),
    Control(Control),
    Shutdown,
}
struct Message {
    request: Request,
    reply: oneshot::Sender<Result<()>>,
}
pub struct Player {
    tx: mpsc::SyncSender<Message>,
    status: Arc<Mutex<PlaybackStatus>>,
    stopping: Arc<AtomicBool>,
    worker: Mutex<Option<std::thread::JoinHandle<()>>>,
}
impl Player {
    pub fn new(path: PathBuf) -> Self {
        let (tx, rx) = mpsc::sync_channel::<Message>(16);
        let status = Arc::new(Mutex::new(PlaybackStatus {
            state: "idle".into(),
            volume: 100.0,
            speed: 1.0,
            ..Default::default()
        }));
        let state = status.clone();
        let stopping = Arc::new(AtomicBool::new(false));
        let flag = stopping.clone();
        let worker = std::thread::spawn(move || {
            let mut engine: Option<Engine> = None;
            while !flag.load(Ordering::Relaxed) {
                match rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(message) => {
                        if matches!(message.request, Request::Shutdown) {
                            break;
                        }
                        let result = (|| {
                            if engine.is_none() {
                                engine = Some(Engine::open(&path, false)?);
                            }
                            let e = engine.as_mut().ok_or_else(error)?;
                            match message.request {
                                Request::Load(url) => {
                                    e.command(&["stop"])?;
                                    e.set("pause", "no")?;
                                    e.command(&["loadfile", &url, "replace"])?;
                                    if let Ok(mut s) = state.lock() {
                                        s.state = "loading".into();
                                        s.error = None;
                                    }
                                    Ok(())
                                }
                                Request::Control(control) => e.control(control),
                                Request::Shutdown => Ok(()),
                            }
                        })();
                        let _ = message.reply.send(result);
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                }
                if let Some(e) = &mut engine {
                    if let Ok(mut s) = state.lock() {
                        e.poll(&mut s);
                    }
                }
                if engine.as_ref().is_some_and(|e| e.shutdown) {
                    engine = None;
                }
            }
            // Engine::drop termina o motor antes de descarregar a DLL.
        });
        Self {
            tx,
            status,
            stopping,
            worker: Mutex::new(Some(worker)),
        }
    }
    async fn send(&self, request: Request) -> Result<()> {
        let (reply, rx) = oneshot::channel();
        self.tx
            .try_send(Message { request, reply })
            .map_err(|_| ServiceError::new("busy", "O player está ocupado."))?;
        rx.await.map_err(|_| error())?
    }
    pub async fn load(&self, url: String) -> Result<()> {
        self.send(Request::Load(url)).await
    }
    pub async fn control(&self, value: Control) -> Result<()> {
        self.send(Request::Control(value)).await
    }
    pub fn status(&self) -> Result<PlaybackStatus> {
        self.status.lock().map(|s| s.clone()).map_err(|_| error())
    }
    pub fn shutdown(&self) {
        self.stopping.store(true, Ordering::Relaxed);
        let (reply, _) = oneshot::channel();
        let _ = self.tx.try_send(Message {
            request: Request::Shutdown,
            reply,
        });
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
    }
}
impl Drop for Player {
    fn drop(&mut self) {
        self.shutdown();
    }
}
#[repr(C)]
struct Event {
    id: c_int,
    error: c_int,
    reply: u64,
    data: *mut c_void,
}
#[repr(C)]
struct EndFile {
    reason: c_int,
    error: c_int,
    playlist_entry_id: i64,
    insert_id: i64,
    insert_num: c_int,
}
type Create = unsafe extern "C" fn() -> *mut c_void;
type Initialize = unsafe extern "C" fn(*mut c_void) -> c_int;
type Set = unsafe extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int;
type Command = unsafe extern "C" fn(*mut c_void, *const *const c_char) -> c_int;
type Get = unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_char;
type Free = unsafe extern "C" fn(*mut c_void);
type Wait = unsafe extern "C" fn(*mut c_void, f64) -> *const Event;
#[link(name = "kernel32")]
unsafe extern "system" {
    fn LoadLibraryExW(path: *const u16, file: *mut c_void, flags: u32) -> *mut c_void;
    fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
    fn FreeLibrary(module: *mut c_void) -> c_int;
}
struct Library(*mut c_void);
impl Drop for Library {
    fn drop(&mut self) {
        unsafe {
            FreeLibrary(self.0);
        }
    }
}
struct Engine {
    handle: *mut c_void,
    set_option: Set,
    set_property: Set,
    command: Command,
    get: Get,
    free: Free,
    wait: Wait,
    destroy: Free,
    _library: Library,
    shutdown: bool,
}
impl Engine {
    fn open(path: &Path, headless: bool) -> Result<Self> {
        use std::os::windows::ffi::OsStrExt;
        if !path.is_absolute() || !path.is_file() {
            return Err(ServiceError::new(
                "player_missing",
                "Motor de vídeo não encontrado.",
            ));
        }
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        // LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32: sem PATH/CWD.
        let library =
            Library(unsafe { LoadLibraryExW(wide.as_ptr(), std::ptr::null_mut(), 0x100 | 0x800) });
        if library.0.is_null() {
            return Err(ServiceError::new(
                "player_missing",
                "Motor de vídeo não disponível.",
            ));
        }
        macro_rules! symbol {
            ($name:literal,$ty:ty) => {{
                let ptr = unsafe { GetProcAddress(library.0, concat!($name, "\0").as_ptr()) };
                if ptr.is_null() {
                    return Err(error());
                }
                // Símbolos ABI C, assinaturas fixadas pelo client.h da versão distribuída.
                unsafe { std::mem::transmute::<*mut c_void, $ty>(ptr) }
            }};
        }
        let create = symbol!("mpv_create", Create);
        let initialize = symbol!("mpv_initialize", Initialize);
        let set_option = symbol!("mpv_set_option_string", Set);
        let set_property = symbol!("mpv_set_property_string", Set);
        let command = symbol!("mpv_command", Command);
        let get = symbol!("mpv_get_property_string", Get);
        let free = symbol!("mpv_free", Free);
        let wait = symbol!("mpv_wait_event", Wait);
        let destroy = symbol!("mpv_terminate_destroy", Free);
        let handle = unsafe { create() };
        if handle.is_null() {
            return Err(error());
        }
        let mut engine = Self {
            handle,
            set_option,
            set_property,
            command,
            get,
            free,
            wait,
            destroy,
            _library: library,
            shutdown: false,
        };
        for (key, value) in [
            ("config", "no"),
            ("terminal", "no"),
            ("msg-level", "all=no"),
            ("input-default-bindings", "yes"),
            ("input-vo-keyboard", "yes"),
            ("osc", "no"),
            ("osd-level", "0"),
            ("title", "NOVA PLAYER — Reprodução"),
            ("hwdec", "auto-safe"),
            ("network-timeout", "15"),
            ("cache", "yes"),
            ("demuxer-max-bytes", "64MiB"),
            ("demuxer-max-back-bytes", "16MiB"),
            ("ytdl", "no"),
            ("load-scripts", "no"),
            ("autoload-files", "no"),
            ("audio-file-auto", "no"),
            ("sub-auto", "no"),
            ("tls-verify", "yes"),
            ("idle", "yes"),
            ("force-window", "no"),
        ] {
            engine.option(key, value)?;
        }
        // Bloquear referências locais e protocolos executáveis em playlists remotas.
        engine.option("access-references", "no")?;
        let protocols = if headless {
            "file,http,https,tls,tcp,udp,rtp,crypto,data"
        } else {
            "http,https,tls,tcp,udp,rtp,crypto,data"
        };
        engine.option(
            "demuxer-lavf-o",
            &format!("protocol_whitelist=\"{protocols}\""),
        )?;
        if headless {
            engine.option("vo", "null")?;
            engine.option("ao", "null")?;
        } else {
            engine.option("force-window", "yes")?;
        }
        if unsafe { initialize(handle) } < 0 {
            return Err(error());
        }
        Ok(engine)
    }
    fn option(&mut self, key: &str, value: &str) -> Result<()> {
        let (key, value) = (
            CString::new(key).map_err(|_| error())?,
            CString::new(value).map_err(|_| error())?,
        );
        if unsafe { (self.set_option)(self.handle, key.as_ptr(), value.as_ptr()) } < 0 {
            #[cfg(test)]
            eprintln!("Opção libmpv recusada: {}", key.to_string_lossy());
            Err(error())
        } else {
            Ok(())
        }
    }
    fn set(&mut self, key: &str, value: &str) -> Result<()> {
        let (key, value) = (
            CString::new(key).map_err(|_| error())?,
            CString::new(value).map_err(|_| error())?,
        );
        if unsafe { (self.set_property)(self.handle, key.as_ptr(), value.as_ptr()) } < 0 {
            Err(error())
        } else {
            Ok(())
        }
    }
    fn command(&mut self, args: &[&str]) -> Result<()> {
        let strings: Vec<CString> = args
            .iter()
            .map(|s| CString::new(*s).map_err(|_| error()))
            .collect::<Result<_>>()?;
        let mut pointers: Vec<*const c_char> = strings.iter().map(|s| s.as_ptr()).collect();
        pointers.push(std::ptr::null());
        if unsafe { (self.command)(self.handle, pointers.as_ptr()) } < 0 {
            Err(error())
        } else {
            Ok(())
        }
    }
    fn property(&self, key: &str) -> Option<String> {
        let key = CString::new(key).ok()?;
        let ptr = unsafe { (self.get)(self.handle, key.as_ptr()) };
        if ptr.is_null() {
            return None;
        }
        let value = unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned();
        unsafe { (self.free)(ptr.cast()) };
        Some(value)
    }
    fn number(&self, key: &str) -> f64 {
        self.property(key)
            .and_then(|s| s.parse::<f64>().ok())
            .filter(|v| v.is_finite())
            .unwrap_or(0.0)
    }
    fn control(&mut self, value: Control) -> Result<()> {
        match value {
            Control::Pause(v) => self.set("pause", if v { "yes" } else { "no" }),
            Control::Mute(v) => self.set("mute", if v { "yes" } else { "no" }),
            Control::Fullscreen(v) => self.set("fullscreen", if v { "yes" } else { "no" }),
            Control::Volume(v) if v.is_finite() && (0.0..=100.0).contains(&v) => {
                self.set("volume", &v.to_string())
            }
            Control::Speed(v) if v.is_finite() && (0.25..=2.0).contains(&v) => {
                self.set("speed", &v.to_string())
            }
            Control::Seek(v)
                if v.is_finite()
                    && v >= 0.0
                    && self.property("seekable").as_deref() == Some("yes") =>
            {
                self.command(&["seek", &v.to_string(), "absolute"])
            }
            Control::Audio(id) if id >= 0 => self.set("aid", &id.to_string()),
            Control::Subtitle(0) => self.set("sid", "no"),
            Control::Subtitle(id) if id > 0 => self.set("sid", &id.to_string()),
            Control::Stop => self.command(&["stop"]),
            _ => Err(ServiceError::new(
                "validation",
                "Controle inválido ou não disponível para esta mídia.",
            )),
        }
    }
    fn poll(&mut self, status: &mut PlaybackStatus) {
        // O ponteiro de evento pertence ao mpv, válido até a próxima espera.
        for _ in 0..64 {
            let ptr = unsafe { (self.wait)(self.handle, 0.0) };
            if ptr.is_null() {
                break;
            }
            let event = unsafe { &*ptr };
            match event.id {
                0 => break,
                1 => {
                    status.state = "stopped".into();
                    self.shutdown = true;
                }
                6 => {
                    status.state = "loading".into();
                    status.error = None;
                }
                8 => {
                    status.state = "playing".into();
                    status.error = None;
                }
                7 => {
                    if !event.data.is_null()
                        && unsafe { &*event.data.cast::<EndFile>() }.reason == 4
                    {
                        status.state = "failed".into();
                        status.error=Some("Não foi possível abrir ou decodificar a mídia. Verifique o acesso à fonte.");
                    } else {
                        status.state = "stopped".into();
                    }
                }
                _ => {}
            }
        }
        status.position = self.number("time-pos");
        status.duration = self.number("duration");
        status.volume = self.number("volume");
        status.speed = self.number("speed");
        status.paused = self.property("pause").as_deref() == Some("yes");
        status.muted = self.property("mute").as_deref() == Some("yes");
        status.seekable = self.property("seekable").as_deref() == Some("yes");
        status.tracks.clear();
        for index in 0..self.number("track-list/count").min(128.0) as usize {
            let prefix = format!("track-list/{index}");
            let kind = self.property(&format!("{prefix}/type")).unwrap_or_default();
            if kind != "audio" && kind != "sub" {
                continue;
            }
            let id = self.number(&format!("{prefix}/id")) as i64;
            let label = self
                .property(&format!("{prefix}/lang"))
                .unwrap_or_else(|| format!("Faixa {id}"));
            let selected = self.property(&format!("{prefix}/selected")).as_deref() == Some("yes");
            status.tracks.push(Track {
                id,
                kind,
                label: label.chars().take(80).collect(),
                selected,
            });
        }
    }
}
impl Drop for Engine {
    fn drop(&mut self) {
        unsafe { (self.destroy)(self.handle) };
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    struct FixtureServer {
        address: std::net::SocketAddr,
        stop: Arc<std::sync::atomic::AtomicBool>,
        thread: Option<std::thread::JoinHandle<()>>,
    }
    impl FixtureServer {
        fn start() -> Self {
            use std::{
                io::{Read, Write},
                sync::atomic::{AtomicBool, Ordering},
            };
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            listener.set_nonblocking(true).unwrap();
            let stop = Arc::new(AtomicBool::new(false));
            let flag = stop.clone();
            let thread = std::thread::spawn(move || {
                while !flag.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut socket, _)) => {
                            let _ = socket.set_read_timeout(Some(Duration::from_secs(2)));
                            let _ = socket.set_write_timeout(Some(Duration::from_secs(2)));
                            let mut buffer = [0; 4096];
                            let n = socket.read(&mut buffer).unwrap_or(0);
                            let request = String::from_utf8_lossy(&buffer[..n]);
                            let path = request
                                .split_whitespace()
                                .nth(1)
                                .unwrap_or("")
                                .trim_start_matches('/');
                            if ![
                                "index.m3u8",
                                "segment0.m2ts",
                                "segment1.m2ts",
                                "segment2.m2ts",
                            ]
                            .contains(&path)
                            {
                                continue;
                            }
                            let body = std::fs::read(
                                Path::new(env!("CARGO_MANIFEST_DIR"))
                                    .join("../tests/fixtures/player-hls")
                                    .join(path),
                            )
                            .unwrap();
                            let mime = if path.ends_with("m3u8") {
                                "application/vnd.apple.mpegurl"
                            } else {
                                "video/mp2t"
                            };
                            let headers=format!("HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());
                            let _ = socket.write_all(headers.as_bytes());
                            let _ = socket.write_all(&body);
                        }
                        Err(_) => std::thread::sleep(Duration::from_millis(10)),
                    }
                }
            });
            Self {
                address,
                stop,
                thread: Some(thread),
            }
        }
    }
    impl Drop for FixtureServer {
        fn drop(&mut self) {
            self.stop.store(true, std::sync::atomic::Ordering::Relaxed);
            if let Some(thread) = self.thread.take() {
                thread.join().unwrap();
            }
        }
    }
    #[test]
    #[ignore = "Exige DLL Windows verificada; executar explicitamente na PoC CI"]
    fn windows_mpv_decodes_local_video_and_pcm_audio() {
        let path = std::env::var("NOVA_MPV_DLL").expect("NOVA_MPV_DLL obrigatório na PoC");
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/player-av.avi");
        let mut engine = Engine::open(Path::new(&path), true).expect("Inicialização libmpv");
        engine
            .command(&["loadfile", fixture.to_str().unwrap(), "replace"])
            .expect("Abrir fixture");
        let deadline = std::time::Instant::now() + Duration::from_secs(15);
        let mut state = PlaybackStatus::default();
        while std::time::Instant::now() < deadline {
            engine.poll(&mut state);
            if state.position > 0.1 {
                break;
            }
            assert!(state.error.is_none(), "Decodificação local falhou");
            std::thread::sleep(Duration::from_millis(30));
        }
        assert!(state.position > 0.1, "O relógio de reprodução deve avançar");
        assert!(
            engine.property("audio-codec-name").is_some(),
            "Áudio deve ser decodificado"
        );
        assert!(
            engine.property("video-codec").is_some(),
            "Vídeo deve ser decodificado"
        );
        engine.control(Control::Pause(true)).unwrap();
        assert_eq!(engine.property("pause").as_deref(), Some("yes"));
        engine.control(Control::Volume(35.0)).unwrap();
        assert_eq!(engine.number("volume"), 35.0);
        engine.control(Control::Seek(1.0)).unwrap();
        engine.control(Control::Mute(true)).unwrap();
        assert_eq!(engine.property("mute").as_deref(), Some("yes"));
        engine.control(Control::Mute(false)).unwrap();
        assert!(engine.control(Control::Volume(101.0)).is_err());
        engine.control(Control::Stop).unwrap();
        // HLS real via servidor HTTP local, sem depender de provedor externo.
        let server = FixtureServer::start();
        let url = format!("http://{}/index.m3u8", server.address);
        engine.set("pause", "no").unwrap();
        engine.command(&["loadfile", &url, "replace"]).unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(15);
        let mut hls = PlaybackStatus::default();
        while std::time::Instant::now() < deadline {
            engine.poll(&mut hls);
            if hls.position > 0.1 {
                break;
            }
            assert!(hls.error.is_none(), "HLS local falhou");
            std::thread::sleep(Duration::from_millis(30));
        }
        assert!(hls.position > 0.1, "Relógio HLS deve avançar");
        assert!(
            engine.property("audio-codec-name").is_some(),
            "Áudio HLS decodificado"
        );
        assert!(
            engine.property("video-codec").is_some(),
            "Vídeo HLS decodificado"
        );
        engine.control(Control::Stop).unwrap();
    }
}
