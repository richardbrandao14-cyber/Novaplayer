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
    pub media_id: Option<String>,
    pub episode_id: Option<String>,
    pub state: String,
    pub hud_ready: bool,
    pub software_video: bool,
    pub action_id: u64,
    pub ui_action: Option<String>,
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
    Chrome { fullscreen: bool, episodes: bool },
    Wake,
    VideoCompatibility(bool),
    Stop,
}
enum Request {
    Load {
        url: String,
        media_id: String,
        episode_id: Option<String>,
        position: f64,
    },
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
    pub fn new(path: PathBuf, surface: Arc<crate::surface::VideoSurface>) -> Self {
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
                            if engine.is_none()
                                && matches!(&message.request, Request::Control(Control::Stop))
                            {
                                return Ok(());
                            }
                            if engine.is_none() {
                                engine = Some(Engine::open_target(
                                    &path,
                                    false,
                                    Some(surface.handle()?),
                                )?);
                            }
                            let e = engine.as_mut().ok_or_else(error)?;
                            match message.request {
                                Request::Load {
                                    url,
                                    media_id,
                                    episode_id,
                                    position,
                                } => {
                                    e.command(&["stop"])?;
                                    e.set("pause", "no")?;
                                    e.command(&[
                                        "loadfile",
                                        &url,
                                        "replace",
                                        "-1",
                                        &format!("start={position}"),
                                    ])?;
                                    if let Ok(mut s) = state.lock() {
                                        s.media_id = Some(media_id);
                                        s.episode_id = episode_id;
                                        s.position = 0.0;
                                        s.duration = 0.0;
                                        s.state = "loading".into();
                                        s.error = None;
                                        s.ui_action = None;
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
    pub async fn load(
        &self,
        url: String,
        media_id: String,
        episode_id: Option<String>,
        position: f64,
    ) -> Result<()> {
        self.send(Request::Load {
            url,
            media_id,
            episode_id,
            position,
        })
        .await
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
/// Extração real, sem janela/áudio, com prazo e cancelamento. URL nunca sai do Rust.
pub(crate) fn extract_frame(
    dll: &Path,
    url: &str,
    directory: &Path,
    cancel: Arc<AtomicBool>,
    position: f64,
) -> Result<Vec<u8>> {
    if cancel.load(Ordering::Relaxed) {
        return Err(error());
    }
    let mut engine = Engine::open_mode(dll, true, None, Some(directory))?;
    engine.command(&[
        "loadfile",
        url,
        "replace",
        "-1",
        &format!("start={position}"),
    ])?;
    let deadline = std::time::Instant::now() + Duration::from_secs(12);
    while std::time::Instant::now() < deadline && !cancel.load(Ordering::Relaxed) {
        if let Ok(entries) = std::fs::read_dir(directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|v| v == "png")
                    && path
                        .metadata()
                        .is_ok_and(|m| m.len() > 0 && m.len() <= 5 * 1024 * 1024)
                {
                    engine.command(&["stop"])?;
                    drop(engine);
                    let bytes = std::fs::read(path).map_err(|_| error())?;
                    if image::load_from_memory(&bytes).is_err() {
                        return Err(error());
                    }
                    return Ok(bytes);
                }
            }
        }
        std::thread::sleep(Duration::from_millis(40));
    }
    let _ = engine.command(&["stop"]);
    Err(error())
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
    #[cfg(test)]
    fn open(path: &Path, headless: bool) -> Result<Self> {
        Self::open_target(path, headless, None)
    }
    fn open_target(path: &Path, headless: bool, target: Option<isize>) -> Result<Self> {
        Self::open_mode(path, headless, target, None)
    }
    fn open_mode(
        path: &Path,
        headless: bool,
        target: Option<isize>,
        frame: Option<&Path>,
    ) -> Result<Self> {
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
            ("input-builtin-bindings", "no"),
            ("input-builtin-dragging", "no"),
            ("input-cursor", "yes"),
            ("input-cursor-passthrough", "no"),
            ("input-vo-keyboard", "yes"),
            ("osc", "no"),
            ("osd-level", "0"),
            ("cursor-autohide", "5000"),
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
        // HLS precisa abrir segmentos. Limitar os protocolos aninhados, em vez
        // de bloquear toda referência (o que também bloqueia streaming válido).
        engine.option("access-references", "yes")?;
        engine.option("load-unsafe-playlists", "no")?;
        let protocols = "http,https,tls,tcp,udp,rtp,crypto,data";
        engine.option(
            "demuxer-lavf-o",
            &format!("protocol_whitelist=\"{protocols}\""),
        )?;
        if headless {
            // Apenas a PoC compilada como teste registra avisos de fixtures locais.
            // A produção continua com terminal e logs desligados.
            #[cfg(test)]
            {
                engine.option("terminal", "yes")?;
                engine.option("msg-level", "all=warn")?;
            }
            engine.option("vo", "null")?;
            engine.option("ao", "null")?;
            engine.option("hwdec", "no")?; // Fixtures de decodificação não devem disputar GPU com a PoC gráfica.
        } else {
            let target = target.ok_or_else(|| {
                ServiceError::new("player_surface", "Superfície de vídeo não preparada.")
            })?;
            engine.option("wid", &target.to_string())?;
            let script = path.parent().ok_or_else(error)?.join("nova-hud.lua");
            if !script.is_file() {
                return Err(ServiceError::new(
                    "player_missing",
                    "Controles do player ausentes no pacote.",
                ));
            }
            engine.option("scripts", script.to_str().ok_or_else(error)?)?;
            engine.option("osc", "yes")?;
            engine.option("osd-level", "1")?;
            engine.option("script-opts", concat!(
                "osc-layout=floating,osc-vidscale=yes,osc-floatingwidth=700,osc-valign=0.8,osc-title=NOVA PLAYER,osc-floatingtitle=no,osc-windowcontrols=no,",
                "osc-background_color=#111113,osc-held_element_color=#E52335,osc-timecode_color=#E52335,",
                "osc-hidetimeout=5000,osc-fadeduration=0,osc-idlescreen=no,",
                "osc-title_mbtn_left_command=,osc-title_mbtn_mid_command=,osc-title_mbtn_right_command=,",
                "osc-menu_mbtn_left_command=script-message-to nova_hud settings,",
                "osc-audio_track_mbtn_left_command=script-message-to nova_hud audio,",
                "osc-audio_track_mbtn_right_command=script-message-to nova_hud audio,",
                "osc-sub_track_mbtn_left_command=script-message-to nova_hud sub,",
                "osc-sub_track_mbtn_right_command=script-message-to nova_hud sub,",
                "osc-volume_mbtn_left_command=script-message-to nova_hud volume,osc-volume_mbtn_right_command=cycle mute,",
                "osc-fullscreen_mbtn_left_command=script-message nova-ui fullscreen,",
                "osc-fullscreen_mbtn_right_command=,",
                "osc-skip_backward_mbtn_left_down_command=script-message-to nova_hud backward,",
                "osc-skip_forward_mbtn_left_down_command=script-message-to nova_hud forward,",
                "osc-custom_button_1_content=${speed}x,",
                "osc-custom_button_1_mbtn_left_command=script-message-to nova_hud speed"
            ))?;
            // libmpv pode usar saída de embedding por padrão. Selecionar explicitamente
            // uma saída que cria janela Windows e o dispositivo de áudio do sistema.
            engine.option("vo", "gpu-next,gpu")?;
            engine.option("ao", "wasapi")?;
            engine.option("force-window", "yes")?;
        }
        if let Some(directory) = frame {
            engine.option("vo", "image")?;
            engine.option("vo-image-format", "png")?;
            engine.option("vo-image-outdir", directory.to_str().ok_or_else(error)?)?;
            engine.option("vo-image-png-compression", "3")?;
            engine.option("frames", "1")?;
            engine.option("audio", "no")?;
            engine.option("network-timeout", "3")?;
            engine.option(
                "vf",
                "lavfi=[scale=640:360:force_original_aspect_ratio=decrease]",
            )?;
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
            Control::Chrome {
                fullscreen,
                episodes,
            } => self.command(&[
                "script-message-to",
                "nova_hud",
                "fullscreen-chrome",
                if fullscreen { "yes" } else { "no" },
                if episodes { "yes" } else { "no" },
            ]),
            Control::Wake => self.command(&["script-message-to", "nova_hud", "activity"]),
            Control::VideoCompatibility(v) => self.set("hwdec", if v { "no" } else { "auto-safe" }),
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
                16 => {
                    #[repr(C)]
                    struct ClientMessage {
                        count: c_int,
                        args: *const *const c_char,
                    }
                    if !event.data.is_null() {
                        let message = unsafe { &*event.data.cast::<ClientMessage>() };
                        if message.count == 2 && !message.args.is_null() {
                            let args = unsafe { std::slice::from_raw_parts(message.args, 2) };
                            if !args[0].is_null() && !args[1].is_null() {
                                let name = unsafe { CStr::from_ptr(args[0]) }.to_bytes();
                                let action = unsafe { CStr::from_ptr(args[1]) }.to_bytes();
                                if name == b"nova-ui" && action == b"hud-ready" {
                                    status.hud_ready = true;
                                }
                                if name == b"nova-ui"
                                    && [b"back".as_slice(), b"escape", b"fullscreen", b"episodes"]
                                        .contains(&action)
                                {
                                    status.action_id = status.action_id.wrapping_add(1);
                                    status.ui_action =
                                        Some(String::from_utf8_lossy(action).into_owned());
                                }
                            }
                        }
                    }
                }
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
        status.software_video = self.property("hwdec").as_deref() == Some("no");
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
                            // Windows pode herdar FIONBIO do listener; ler headers requer socket bloqueante.
                            socket.set_nonblocking(false).unwrap();
                            let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
                            let _ = socket.set_write_timeout(Some(Duration::from_secs(5)));
                            // TCP é um fluxo: uma leitura pode retornar só parte da linha/headers.
                            let mut buffer = Vec::new();
                            let mut chunk = [0; 2048];
                            while buffer.len() < 16384
                                && !buffer.windows(4).any(|w| w == b"\r\n\r\n")
                            {
                                match socket.read(&mut chunk) {
                                    Ok(0) | Err(_) => break,
                                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                                }
                            }
                            let request = String::from_utf8_lossy(&buffer);
                            let path = request
                                .split_whitespace()
                                .nth(1)
                                .unwrap_or("")
                                .trim_start_matches('/');
                            let folder = Path::new(env!("CARGO_MANIFEST_DIR"))
                                .join("tests/fixtures/player-hls");
                            let (body, mime) = if path.starts_with("player_api.php?") {
                                let query = path.split_once('?').unwrap().1;
                                let fields = url::form_urlencoded::parse(query.as_bytes())
                                    .collect::<std::collections::HashMap<_, _>>();
                                let action = fields.get("action").map(|v| v.as_ref());
                                let value = match action {
                                    None => {
                                        serde_json::json!({"user_info":{"auth":1,"status":"Active"}})
                                    }
                                    Some(
                                        "get_live_categories"
                                        | "get_vod_categories"
                                        | "get_series_categories",
                                    ) => {
                                        serde_json::json!([{"category_id":"7","category_name":"Fixture"}])
                                    }
                                    Some("get_live_streams") => {
                                        serde_json::json!([{"stream_id":1,"name":"Canal fixture","category_id":"7","container_extension":"ts"}])
                                    }
                                    Some("get_vod_streams") => {
                                        serde_json::json!([{"stream_id":2,"name":"Filme fixture","category_id":"7","container_extension":"mp4"}])
                                    }
                                    Some("get_series") => {
                                        serde_json::json!([{"series_id":3,"name":"Série fixture","category_id":"7"}])
                                    }
                                    Some("get_series_info") => {
                                        serde_json::json!({"episodes":{"1":[{"id":4,"title":"Episódio fixture","container_extension":"mp4"}]}})
                                    }
                                    _ => serde_json::Value::Null,
                                };
                                (serde_json::to_vec(&value).unwrap(), "application/json")
                            } else if path == "unsafe.m3u8" {
                                let local = url::Url::from_file_path(
                                    folder.join("segment0.ts").canonicalize().unwrap(),
                                )
                                .unwrap();
                                (format!("#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1,\n{local}\n#EXT-X-ENDLIST\n").into_bytes(),"application/vnd.apple.mpegurl")
                            } else if path == "live/fixture-user/fixture-pass/1.ts" {
                                (
                                    std::fs::read(folder.join("segment0.ts")).unwrap(),
                                    "video/mp2t",
                                )
                            } else if [
                                "movie/fixture-user/fixture-pass/2.mp4",
                                "series/fixture-user/fixture-pass/4.mp4",
                            ]
                            .contains(&path)
                            {
                                (
                                    std::fs::read(folder.parent().unwrap().join("player-av.mp4"))
                                        .unwrap(),
                                    "video/mp4",
                                )
                            } else if ["index.m3u8", "segment0.ts", "segment1.ts", "segment2.ts"]
                                .contains(&path)
                            {
                                (
                                    std::fs::read(folder.join(path)).unwrap(),
                                    if path.ends_with("m3u8") {
                                        "application/vnd.apple.mpegurl"
                                    } else {
                                        "video/mp2t"
                                    },
                                )
                            } else {
                                let _=socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                                continue;
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
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/player-av.avi");
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
        let unsafe_url = format!("http://{}/unsafe.m3u8", server.address);
        engine
            .command(&["loadfile", &unsafe_url, "replace"])
            .unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(8);
        let mut blocked = PlaybackStatus::default();
        while std::time::Instant::now() < deadline {
            engine.poll(&mut blocked);
            assert!(
                blocked.state != "playing" || blocked.position <= 0.1,
                "HLS remoto não pode ler segmentos do disco local"
            );
            if blocked.state == "failed" {
                break;
            }
            std::thread::sleep(Duration::from_millis(30));
        }
        assert_eq!(
            blocked.state, "failed",
            "Referência local em HLS remoto deve ser rejeitada"
        );
        engine.control(Control::Stop).unwrap();
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    #[ignore = "Exige DLL Windows verificada e DPAPI; gate integrado de reprodução"]
    async fn windows_mpv_xtream_import_to_playback_live_movie_and_episode() {
        use crate::{
            core::models::CatalogQuery,
            services::{
                imports::{Backend, SourceDraft},
                secrets::WindowsProtector,
            },
        };
        let dll = std::env::var("NOVA_MPV_DLL").expect("NOVA_MPV_DLL obrigatório");
        let server = FixtureServer::start();
        let root = std::env::temp_dir().join(format!("nova-playback-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let backend = Backend::new(
            root.join("catalog.sqlite3"),
            root.join("cache"),
            Arc::new(WindowsProtector),
        )
        .unwrap();
        let source = backend
            .save_source(SourceDraft {
                name: "Fixture autorizada".into(),
                kind: "xtream".into(),
                url: format!("http://{}/player_api.php", server.address),
                username: "fixture-user".into(),
                password: "fixture-pass".into(),
                source_id: None,
            })
            .unwrap();
        let job = backend.start(source.id.clone()).unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(20);
        loop {
            let state = backend.status(&job).unwrap();
            assert!(state.error.is_none(), "Importação Xtream deve concluir");
            if state.state == "completed" {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "Importação excedeu limite"
            );
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let mut urls = Vec::new();
        for kind in ["live", "movie", "series"] {
            let page = backend
                .query(&CatalogQuery {
                    source_id: Some(source.id.clone()),
                    kind: Some(kind.into()),
                    limit: 10,
                    ..Default::default()
                })
                .unwrap();
            assert_eq!(page.total, 1, "Cada categoria deve chegar ao catálogo real");
            let media = &page.items[0];
            let url = if kind == "series" {
                let seasons = backend.series(&media.id).await.unwrap();
                let episode = &seasons[0].episodes[0];
                assert!(
                    episode.id.starts_with(&media.id),
                    "ID interno deve pertencer à série"
                );
                backend.playback_url(&media.id, Some(&episode.id)).unwrap()
            } else {
                backend.playback_url(&media.id, None).unwrap()
            };
            urls.push((kind, url));
        }
        let mut engine = Engine::open(Path::new(&dll), true).unwrap();
        for (kind, url) in urls {
            engine.command(&["loadfile", &url, "replace"]).unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(15);
            let mut state = PlaybackStatus::default();
            while std::time::Instant::now() < deadline {
                engine.poll(&mut state);
                assert!(state.error.is_none(), "{kind}: erro de reprodução");
                if state.state == "playing" && state.position > 0.1 {
                    break;
                }
                std::thread::sleep(Duration::from_millis(30));
            }
            assert!(
                state.state == "playing" && state.position > 0.1,
                "{kind}: reprodução deve avançar"
            );
            assert!(
                engine.property("audio-codec-name").is_some(),
                "{kind}: áudio decodificado"
            );
            assert!(
                engine.property("video-codec").is_some(),
                "{kind}: vídeo decodificado"
            );
            engine.control(Control::Stop).unwrap();
        }
        drop(engine);
        drop(backend);
        drop(server);
        std::fs::remove_dir_all(root).unwrap();
    }
    // user-data é um nó JSON; a API string preserva aspas de valores string.
    fn hud_value(engine: &Engine, key: &str) -> Option<String> {
        engine
            .property(key)
            .and_then(|value| serde_json::from_str(&value).ok())
    }
    #[test]
    #[ignore = "Exige desktop Windows: HWND filho, GPU, Lua HUD e resize"]
    fn windows_mpv_embedded_surface_and_overlay_hud() {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let dll = std::env::var("NOVA_MPV_DLL").unwrap();
        let name: Vec<u16> = "STATIC\0".encode_utf16().collect();
        let title: Vec<u16> = "NOVA embedding PoC\0".encode_utf16().collect();
        let parent = unsafe {
            CreateWindowExW(
                0,
                name.as_ptr(),
                title.as_ptr(),
                WS_OVERLAPPEDWINDOW | WS_VISIBLE | 0x100,
                40,
                40,
                1000,
                700,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            )
        };
        assert!(!parent.is_null(), "Criar janela de teste Windows");
        unsafe {
            SetWindowPos(
                parent,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
        let surface = crate::surface::VideoSurface::new();
        surface
            .place(
                parent as isize,
                crate::surface::SurfaceRect {
                    x: 0,
                    y: 0,
                    width: 960,
                    height: 600,
                    visible: true,
                },
            )
            .unwrap();
        let child = surface.handle().unwrap();
        assert_eq!(
            unsafe { GetParent(child as *mut c_void) },
            parent,
            "Vídeo deve pertencer à janela do aplicativo"
        );
        let (resize_tx, resize_rx) = std::sync::mpsc::sync_channel(1);
        let worker = std::thread::spawn(move || {
            let mut engine = Engine::open_target(Path::new(&dll), false, Some(child)).unwrap();
            engine.set("aid", "no").unwrap(); // CI não tem alto-falante; áudio é coberto nos outros gates.
            let file = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/player-av.mp4");
            engine
                .command(&["loadfile", file.to_str().unwrap(), "replace"])
                .unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(20);
            let mut state = PlaybackStatus::default();
            while std::time::Instant::now() < deadline {
                engine.poll(&mut state);
                assert!(state.error.is_none(), "Reprodução embutida deve abrir");
                if state.hud_ready && state.position > 0.1 {
                    break;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            assert!(state.hud_ready, "Script NOVA HUD deve carregar");
            assert!(state.position > 0.1, "Vídeo deve avançar no HWND filho");
            assert!(
                engine.property("current-vo").is_some(),
                "Saída gráfica real deve existir"
            );
            assert!(
                engine.property("user-data/osc/visibility").is_some(),
                "HUD OSC deve estar ativo"
            );
            engine.set("pause", "yes").unwrap();
            resize_tx.send(()).unwrap();
            let resized_deadline = std::time::Instant::now() + Duration::from_secs(4);
            while engine.number("osd-dimensions/w") != 800.0
                && std::time::Instant::now() < resized_deadline
            {
                std::thread::sleep(Duration::from_millis(10));
            }
            assert_eq!(
                engine.number("osd-dimensions/w"),
                800.0,
                "Vídeo deve acompanhar o resize da superfície"
            );
            // Enviar entrada à janela real do mpv: testar script-binding não prova hit-testing.
            engine
                .command(&["script-message-to", "osc", "osc-visibility", "always"])
                .unwrap();
            std::thread::sleep(Duration::from_millis(200));
            let video_hwnd = unsafe { GetWindow(child as *mut c_void, GW_CHILD) };
            assert!(
                !video_hwnd.is_null(),
                "Janela interativa do mpv deve existir"
            );
            let point = |x: i32, y: i32| (x | (y << 16)) as isize;
            let click = |engine: &mut Engine, x: i32, y: i32| unsafe {
                let mut screen = windows_sys::Win32::Foundation::POINT { x, y };
                windows_sys::Win32::Graphics::Gdi::ClientToScreen(video_hwnd, &mut screen);
                let moved = SetCursorPos(screen.x, screen.y);
                std::thread::sleep(Duration::from_millis(120));
                let hit = WindowFromPoint(screen);
                eprintln!(
                    "HUD_POINTER moved={moved} hit_video={} hit_descendant={}",
                    hit == video_hwnd,
                    IsChild(video_hwnd, hit)
                );
                SendMessageW(video_hwnd, WM_MOUSEMOVE, 0, point(x, y));
                std::thread::sleep(Duration::from_millis(180));
                assert_eq!(
                    SendMessageW(
                        child as *mut c_void,
                        WM_NCHITTEST,
                        0,
                        point(screen.x, screen.y)
                    ),
                    HTCLIENT as isize,
                    "Host do vídeo deve receber mouse, sem HTTRANSPARENT"
                );
                // A estação de entrada da CI pode estar fora deste desktop (hit_video=false).
                // Completar a sequência nativa de entrada sem chamar callbacks do OSC.
                engine.command(&["keypress", "MOUSE_ENTER"]).unwrap();
                std::thread::sleep(Duration::from_millis(60));
                SendMessageW(video_hwnd, WM_LBUTTONDOWN, 1, point(x, y));
                std::thread::sleep(Duration::from_millis(60));
                SendMessageW(video_hwnd, WM_LBUTTONUP, 0, point(x, y));
            };
            click(&mut engine, 400, 396);
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while engine.property("pause").as_deref() != Some("no")
                && std::time::Instant::now() < deadline
            {
                std::thread::sleep(Duration::from_millis(20));
            }
            if engine.property("pause").as_deref() != Some("no") {
                let diagnostic = Path::new(&dll).parent().unwrap().join("hud-diagnostic.png");
                engine
                    .command(&["screenshot-to-file", diagnostic.to_str().unwrap(), "window"])
                    .unwrap();
                let shot = image::open(&diagnostic)
                    .unwrap()
                    .thumbnail(320, 180)
                    .to_rgb8();
                let mut jpeg = Vec::new();
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 45)
                    .encode_image(&shot)
                    .unwrap();
                use base64::Engine as _;
                let encoded = base64::engine::general_purpose::STANDARD.encode(jpeg);
                for (index, chunk) in encoded.as_bytes().chunks(900).enumerate() {
                    eprintln!(
                        "HUD_IMAGE_PART_{index}:{}",
                        std::str::from_utf8(chunk).unwrap()
                    );
                }
                eprintln!(
                    "HUD_CLICK mouse={:?} dimensions={:?} options={:?}",
                    engine.property("mouse-pos"),
                    engine.property("osd-dimensions"),
                    engine.property("script-opts")
                );
                if let Some(data) = engine
                    .property("input-bindings")
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                {
                    if let Some(items) = data.as_array() {
                        for item in items.iter().filter(|v| {
                            v.get("key")
                                .and_then(|v| v.as_str())
                                .is_some_and(|v| v.eq_ignore_ascii_case("MBTN_LEFT"))
                        }) {
                            eprintln!("HUD_CLICK binding={item}");
                        }
                    }
                }
            }
            assert_eq!(
                engine.property("pause").as_deref(),
                Some("no"),
                "Clique real no HUD deve continuar reprodução"
            );
            std::thread::sleep(Duration::from_millis(350)); // fora do intervalo de duplo clique
            click(&mut engine, 400, 396);
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while engine.property("pause").as_deref() != Some("yes")
                && std::time::Instant::now() < deadline
            {
                std::thread::sleep(Duration::from_millis(20));
            }
            assert_eq!(
                engine.property("pause").as_deref(),
                Some("yes"),
                "Segundo clique real deve pausar"
            );
            engine.control(Control::Volume(80.0)).unwrap();
            unsafe {
                let mut screen = windows_sys::Win32::Foundation::POINT { x: 583, y: 396 };
                windows_sys::Win32::Graphics::Gdi::ClientToScreen(video_hwnd, &mut screen);
                SetCursorPos(screen.x, screen.y);
                SendMessageW(video_hwnd, WM_MOUSEMOVE, 0, point(583, 396));
            }
            std::thread::sleep(Duration::from_millis(150));
            engine.command(&["keypress", "MOUSE_ENTER"]).unwrap();
            std::thread::sleep(Duration::from_millis(60));
            unsafe {
                SendMessageW(
                    video_hwnd,
                    WM_MOUSEWHEEL,
                    ((-120i32 as u32) << 16) as usize,
                    point(583, 396),
                );
            }
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while engine.number("volume") >= 80.0 && std::time::Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(20));
            }
            assert!(
                engine.number("volume") < 80.0,
                "Roda do mouse sobre volume deve baixar som de verdade"
            );
            engine.control(Control::VideoCompatibility(true)).unwrap();
            assert_eq!(engine.property("hwdec").as_deref(), Some("no"));
            engine.control(Control::VideoCompatibility(false)).unwrap();
            engine
                .command(&["script-binding", "nova_hud/nova-fullscreen"])
                .unwrap();
            let action_deadline = std::time::Instant::now() + Duration::from_secs(2);
            while state.ui_action.as_deref() != Some("fullscreen")
                && std::time::Instant::now() < action_deadline
            {
                engine.poll(&mut state);
                std::thread::sleep(Duration::from_millis(10));
            }
            assert_eq!(
                state.ui_action.as_deref(),
                Some("fullscreen"),
                "HUD deve encaminhar ação ao aplicativo"
            );
            engine
                .control(Control::Chrome {
                    fullscreen: true,
                    episodes: true,
                })
                .unwrap();
            std::thread::sleep(Duration::from_millis(200));
            assert_eq!(
                hud_value(&engine, "user-data/nova/visibility").as_deref(),
                Some("visible")
            );
            std::thread::sleep(Duration::from_millis(5300));
            assert_eq!(
                hud_value(&engine, "user-data/nova/visibility").as_deref(),
                Some("hidden"),
                "Cabeçalho deve sumir após inatividade mesmo pausado"
            );
            assert_eq!(
                hud_value(&engine, "user-data/osc/visibility").as_deref(),
                Some("never")
            );
            engine.command(&["keypress", "x"]).unwrap();
            std::thread::sleep(Duration::from_millis(150));
            assert_eq!(
                hud_value(&engine, "user-data/nova/visibility").as_deref(),
                Some("visible"),
                "Teclado deve reativar controles"
            );
            engine
                .control(Control::Chrome {
                    fullscreen: false,
                    episodes: true,
                })
                .unwrap();
            engine
                .command(&["script-message-to", "osc", "osc-visibility", "always"])
                .unwrap();
            std::thread::sleep(Duration::from_millis(150));
            let image = Path::new(&dll).parent().unwrap().join("embedded-poc.png");
            engine
                .command(&["screenshot-to-file", image.to_str().unwrap(), "window"])
                .unwrap();
            assert!(
                image.is_file(),
                "Captura da superfície gráfica deve ser gerada"
            );
            let pixels = image::open(&image).unwrap().into_rgb8();
            let colors = pixels
                .enumerate_pixels()
                .filter(|(x, y, _)| {
                    *x > 100 && *x < 700 && *y > 60 && *y < 300 && x % 8 == 0 && y % 8 == 0
                })
                .map(|(_, _, pixel)| pixel.0)
                .collect::<std::collections::HashSet<_>>();
            assert!(
                colors.len() > 16,
                "A captura deve conter quadros de vídeo, não somente fundo preto e HUD"
            );
            engine.control(Control::Stop).unwrap();
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(35);
        while !worker.is_finished() && std::time::Instant::now() < deadline {
            if resize_rx.try_recv().is_ok() {
                surface
                    .place(
                        parent as isize,
                        crate::surface::SurfaceRect {
                            x: 0,
                            y: 0,
                            width: 800,
                            height: 450,
                            visible: true,
                        },
                    )
                    .unwrap();
            }
            unsafe {
                let mut message: MSG = std::mem::zeroed();
                while PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                    TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        assert!(worker.is_finished(), "PoC gráfica não deve travar");
        let result = worker.join();
        unsafe { DestroyWindow(parent) };
        result.unwrap();
    }
    #[test]
    #[ignore = "Exige DLL Windows verificada: frame real sem áudio e retomada"]
    fn windows_mpv_frame_preview_and_resume() {
        let dll = PathBuf::from(std::env::var("NOVA_MPV_DLL").unwrap());
        let directory =
            std::env::temp_dir().join(format!("nova-frame-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let media = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/player-av.mp4");
        let bytes = extract_frame(
            &dll,
            media.to_str().unwrap(),
            &directory,
            Arc::new(AtomicBool::new(false)),
            1.0,
        )
        .unwrap();
        let image = image::load_from_memory(&bytes).unwrap();
        assert!(
            image.width() > 0
                && image.width() <= 640
                && image.height() > 0
                && image.height() <= 360,
            "Frame deve ser real e limitado"
        );
        let mut engine = Engine::open(&dll, true).unwrap();
        engine
            .command(&[
                "loadfile",
                media.to_str().unwrap(),
                "replace",
                "-1",
                "start=1",
            ])
            .unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        let mut state = PlaybackStatus::default();
        while std::time::Instant::now() < deadline {
            engine.poll(&mut state);
            if state.position >= 1.0 {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(
            state.position >= 1.0,
            "Retomada deve respeitar posição solicitada"
        );
        drop(engine);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
