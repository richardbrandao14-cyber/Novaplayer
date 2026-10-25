import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minimize, Pause, Play, Settings2, Volume2, VolumeX, ListVideo, SkipBack, SkipForward } from "lucide-react";
import { nativeApi, nativeError, playbackLifecycle, type PlaybackStatus, type PlayerControl, type SurfaceRect } from "../../integrations/native";
import { usePlaybackStore, type PlaybackSession } from "../../state/usePlaybackStore";

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ""}${(seconds >= 3600 ? String(Math.floor(seconds / 60) % 60).padStart(2, "0") : Math.floor(seconds / 60) % 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function NativePlayer({ session, onClose }: { session: PlaybackSession; onClose: () => void }) {
  const canvas = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<PlaybackStatus | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [episodes, setEpisodes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [retry, setRetry] = useState(0);
  const handledAction = useRef(0);
  const ready = useRef(false);
  const start = usePlaybackStore((s) => s.start);
  const { item, episodeId } = session;
  const title = session.episodeTitle || item.name || "Título não fornecido";

  async function control(command: PlayerControl) {
    try { await nativeApi.playerControl(command); }
    catch (e) { setError(nativeError(e)); }
  }
  async function toggleFullscreen() {
    try { await nativeApi.playerControl({ kind: "fullscreen", value: !fullscreen }); setFullscreen(!fullscreen); }
    catch (e) { setError(nativeError(e)); }
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    screen.current?.focus();
    return () => { previous?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    ready.current = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let last: SurfaceRect = { x: 0, y: 0, width: 1, height: 1, visible: false };
    function rect(): SurfaceRect {
      const bounds = canvas.current?.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      return { x: Math.max(0, Math.round((bounds?.left ?? 0) * scale)), y: Math.max(0, Math.round((bounds?.top ?? 0) * scale)), width: Math.max(1, Math.round((bounds?.width || 960) * scale)), height: Math.max(1, Math.round((bounds?.height || 540) * scale)), visible: true };
    }
    function resize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void playbackLifecycle(async () => { if (active) { last = rect(); await nativeApi.surface(last); } }).catch((e) => { if (active) setError(nativeError(e)); });
      });
    }
    void playbackLifecycle(async () => {
      if (!active) return;
      last = rect();
      await nativeApi.surface(last);
      if (!active) return;
      await nativeApi.play(item.id, episodeId);
      if (active) ready.current = true;
    }).catch((e) => { if (active) setError(nativeError(e)); });
    if (typeof ResizeObserver !== "undefined" && canvas.current) { observer = new ResizeObserver(resize); observer.observe(canvas.current); }
    window.addEventListener("resize", resize);
    return () => {
      active = false; observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", resize);
      void playbackLifecycle(async () => {
        try { await nativeApi.surface({ ...last, visible: false }); }
        finally { await nativeApi.playerControl({ kind: "stop" }); }
      }).catch(() => {});
    };
  }, [item.id, episodeId, retry]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const next = await nativeApi.playerStatus(); if (active && ready.current) setStatus(next); }
      catch (e) { if (active) setError(nativeError(e)); }
      if (active) timer = setTimeout(() => void poll(), 300);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!status?.actionId || status.actionId === handledAction.current) return;
    handledAction.current = status.actionId;
    if (status.uiAction === "fullscreen" || (status.uiAction === "escape" && fullscreen)) {
      void nativeApi.playerControl({ kind: "fullscreen", value: !fullscreen }).then(() => setFullscreen(!fullscreen)).catch((e) => setError(nativeError(e)));
    } else if (status.uiAction === "back" || status.uiAction === "escape") onClose();
  }, [status, fullscreen, onClose]);
  useEffect(() => () => { void nativeApi.playerControl({ kind: "fullscreen", value: false }).catch(() => {}); }, []);
  const failure = error || status?.error;
  const total = status?.duration ?? 0;
  return <main ref={screen} tabIndex={-1} className="watch-screen" aria-label={`Assistindo ${title}`} onKeyDown={(event) => {
    const target = event.target;
    if (event.ctrlKey || event.metaKey || event.altKey || target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === " " && !(target instanceof HTMLButtonElement)) { event.preventDefault(); void control({ kind: "pause", value: !status?.paused }); }
    else if (event.key === "Escape") { event.preventDefault(); if (settings || episodes) { setSettings(false); setEpisodes(false); } else if (fullscreen) void toggleFullscreen(); else onClose(); }
    else if (event.key.toLowerCase() === "f") { event.preventDefault(); void toggleFullscreen(); }
    else if (event.key.toLowerCase() === "m") { event.preventDefault(); void control({ kind: "mute", value: !status?.muted }); }
    else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && status?.seekable) { event.preventDefault(); void control({ kind: "seek", value: Math.max(0, Math.min(total || Infinity, status.position + (event.key === "ArrowLeft" ? -10 : 10))) }); }
  }}>
    <header className="watch-header">
      <button className="watch-back" onClick={onClose}><ArrowLeft size={21} /> Voltar</button>
      <div className="watch-title"><span>{item.kind === "live" ? "AO VIVO" : item.kind === "series" ? item.name : "NOVA PLAYER"}</span><h1>{title}</h1></div>
      {session.seasons && <button className="watch-action" onClick={() => { setEpisodes(!episodes); setSettings(false); }} aria-expanded={episodes}><ListVideo size={19} /> Episódios</button>}
      <button className="watch-action" onClick={() => { setSettings(!settings); setEpisodes(false); }} aria-expanded={settings}><Settings2 size={19} /> Ajustes</button>
      <button className="watch-action" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
    </header>
    <div className="watch-body">
      <div className="watch-stage">
        <div ref={canvas} className="watch-native-canvas" aria-label="Vídeo integrado com controles sobre a imagem" />
        <div className="watch-status" role="status">{failure ? "Falha ao abrir conteúdo" : status?.state === "loading" ? "Preparando sua reprodução…" : ""}</div>
      </div>
      {(settings || episodes) && <aside className="watch-panel" aria-label={episodes ? "Episódios da série" : "Configurações de reprodução"}>
        {episodes ? <><h2>Temporadas e episódios</h2>{session.seasons?.map((season) => <section key={season.id ?? season.number}><h3>Temporada {season.number}</h3>{season.episodes.map((episode, index) => <button className={`watch-episode ${episode.id === episodeId ? "selected" : ""}`} key={episode.id} onClick={() => start({ ...session, episodeId: episode.id, episodeTitle: episode.title || episode.name || `Episódio ${index + 1}` })}><span>{index + 1}</span><strong>{episode.title || episode.name || "Título não fornecido"}</strong><Play size={16} /></button>)}</section>)}</> : <>
          <h2>Do seu jeito</h2>
          <label>Velocidade<select value={status?.speed || 1} onChange={(e) => void control({ kind: "speed", value: Number(e.target.value) })}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
          <label>Áudio<select value={status?.tracks.find((t) => t.kind === "audio" && t.selected)?.id ?? ""} onChange={(e) => void control({ kind: "audio", value: Number(e.target.value) })}><option value="" disabled>Selecione uma faixa</option>{status?.tracks.filter((t) => t.kind === "audio").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label>Legendas<select value={status?.tracks.find((t) => t.kind === "sub" && t.selected)?.id ?? 0} onChange={(e) => void control({ kind: "subtitle", value: Number(e.target.value) })}><option value="0">Desativadas</option>{status?.tracks.filter((t) => t.kind === "sub").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <p>Espaço pausa · ← → avançam ou voltam · F alterna tela cheia · Esc volta.</p>
        </>}
      </aside>}
    </div>
    <footer className={`watch-toolbar ${status?.hudReady && !failure ? "hud-native-ready" : ""}`} aria-label="Controles acessíveis da reprodução">
      {failure ? <><p role="alert">{failure}</p><button onClick={() => { setError(""); setRetry((v) => v + 1); }}>Tentar novamente</button></> : <>
        <button aria-label={status?.paused ? "Continuar" : "Pausar"} onClick={() => void control({ kind: "pause", value: !status?.paused })}>{status?.paused ? <Play size={20} /> : <Pause size={20} />}</button>
        <button aria-label="Voltar 10 segundos" disabled={!status?.seekable} onClick={() => void control({ kind: "seek", value: Math.max(0, (status?.position ?? 0) - 10) })}><SkipBack size={18} /></button>
        <button aria-label="Avançar 10 segundos" disabled={!status?.seekable} onClick={() => void control({ kind: "seek", value: Math.min(total || Infinity, (status?.position ?? 0) + 10) })}><SkipForward size={18} /></button>
        <span>{clock(status?.position ?? 0)}</span>
        <input aria-label="Posição da reprodução" type="range" min="0" max={Math.max(1, total)} value={Math.min(status?.position ?? 0, total)} disabled={!status?.seekable || total <= 0} onChange={(e) => void control({ kind: "seek", value: Number(e.target.value) })} />
        <span>{total > 0 ? clock(total) : "AO VIVO"}</span>
        <button aria-label={status?.muted ? "Ativar som" : "Silenciar"} onClick={() => void control({ kind: "mute", value: !status?.muted })}>{status?.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <input className="watch-volume" aria-label="Volume" type="range" min="0" max="100" value={Math.round(status?.volume ?? 100)} onChange={(e) => void control({ kind: "volume", value: Number(e.target.value) })} />
      </>}
    </footer>
  </main>;
}
