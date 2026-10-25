import { useEffect, useState } from "react";
import { nativeApi, nativeError, type PlaybackStatus, type PlayerControl } from "../../integrations/native";
import { Button } from "../../ui/Button";

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function NativePlayer({ mediaId, episodeId }: { mediaId: string; episodeId?: string | undefined }) {
  const [status, setStatus] = useState<PlaybackStatus | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await nativeApi.playerStatus();
        if (active) setStatus(next);
      } catch (e) { if (active) setError(nativeError(e)); }
      if (active) timer = setTimeout(() => void poll(), 600);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, []);
  async function play() {
    setOpening(true); setError("");
    try { await nativeApi.play(mediaId, episodeId); }
    catch (e) { setError(nativeError(e)); }
    finally { setOpening(false); }
  }
  async function control(command: PlayerControl) {
    setError("");
    try { await nativeApi.playerControl(command); }
    catch (e) { setError(nativeError(e)); }
  }
  const active = status && ["playing", "loading"].includes(status.state);
  const labels: Record<string, string> = { idle: "Pronto", loading: "Abrindo mídia…", playing: status?.paused ? "Pausado" : "Reproduzindo", failed: "Falha na reprodução", stopped: "Parado" };
  return <section className="native-player" aria-label="Player nativo">
    <div className="native-player-heading">
      <Button disabled={opening} onClick={() => void play()}>{opening ? "Abrindo…" : episodeId ? "Reproduzir episódio" : "Reproduzir agora"}</Button>
      <span role="status">{status ? labels[status.state] ?? "Pronto" : "Consultando player…"}</span>
    </div>
    <p className="muted">O vídeo abre em uma janela própria. Os controles abaixo atuam na reprodução atual.</p>
    {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
    {active && <>
      <div className="native-player-controls">
        <Button variant="secondary" onClick={() => void control({ kind: "pause", value: !status.paused })}>{status.paused ? "Continuar" : "Pausar"}</Button>
        <Button variant="secondary" onClick={() => void control({ kind: "stop" })}>Parar</Button>
        <Button variant="secondary" onClick={() => void control({ kind: "mute", value: !status.muted })}>{status.muted ? "Ativar som" : "Silenciar"}</Button>
        <Button variant="secondary" onClick={() => void control({ kind: "fullscreen", value: true })}>Tela cheia</Button>
        <Button variant="ghost" onClick={() => void control({ kind: "fullscreen", value: false })}>Sair da tela cheia</Button>
      </div>
      <label>Volume <input aria-label="Volume" type="range" min="0" max="100" value={Math.round(status.volume)} onChange={(e) => void control({ kind: "volume", value: Number(e.target.value) })} /></label>
      <div>{clock(status.position)} / {status.duration > 0 ? clock(status.duration) : "Ao vivo / duração indisponível"}</div>
      {status.seekable && status.duration > 0 && <input aria-label="Posição da reprodução" type="range" min="0" max={status.duration} step="1" value={Math.min(status.position, status.duration)} onChange={(e) => void control({ kind: "seek", value: Number(e.target.value) })} />}
      <div className="native-player-controls">
        <label>Velocidade <select aria-label="Velocidade" value={status.speed || 1} onChange={(e) => void control({ kind: "speed", value: Number(e.target.value) })}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
        {status.tracks.some((t) => t.kind === "audio") && <label>Áudio <select aria-label="Faixa de áudio" value={status.tracks.find((t) => t.kind === "audio" && t.selected)?.id ?? ""} onChange={(e) => void control({ kind: "audio", value: Number(e.target.value) })}><option value="" disabled>Selecionar</option>{status.tracks.filter((t) => t.kind === "audio").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
        <label>Legendas <select aria-label="Legendas" value={status.tracks.find((t) => t.kind === "sub" && t.selected)?.id ?? 0} onChange={(e) => void control({ kind: "subtitle", value: Number(e.target.value) })}><option value="0">Desativadas</option>{status.tracks.filter((t) => t.kind === "sub").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      </div>
      {!status.seekable && <p className="muted">Esta fonte não permite avançar ou retroceder.</p>}
    </>}
  </section>;
}
