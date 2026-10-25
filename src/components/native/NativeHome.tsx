import { useEffect, useState } from "react";
import { ArrowRight, Info, Play, Tv } from "lucide-react";
import { nativeApi, nativeAvailable, nativeError } from "../../integrations/native";
import type { NativeCatalogItem } from "../../domain/native/types";
import { usePlaybackStore } from "../../state/usePlaybackStore";
import { useAppStore } from "../../state/useAppStore";
import { NativeArtwork } from "./NativeArtwork";
import { NativeDetails } from "./NativeDetails";
import { NativeCatalogBrowser } from "./NativeCatalogBrowser";
import { DesktopRequired } from "./DesktopRequired";
type Row = { title: string; kind: "movie" | "series" | "live" | "unknown"; items: NativeCatalogItem[] };
export function NativeHome() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<NativeCatalogItem | null>(null);
  const start = usePlaybackStore((s) => s.start);
  const navigate = useAppStore((s) => s.navigate);
  const search = useAppStore((s) => s.search);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true;
    void Promise.all(([{ kind: "movie", title: "Uma noite de cinema" }, { kind: "series", title: "Sua próxima série" }, { kind: "live", title: "Acontecendo agora" }, { kind: "unknown", title: "Explore sua lista" }] as const).map(async (row) => ({ ...row, items: (await nativeApi.query({ kind: row.kind, offset: 0, limit: 14, sort: "name" })).items }))).then((result) => { if (active) setRows(result); }).catch((e) => { if (active) setError(nativeError(e)); });
    return () => { active = false; };
  }, []);
  if (!nativeAvailable()) return <DesktopRequired />;
  if (search) return <NativeCatalogBrowser title="Resultados da busca" />;
  if (error) return <div className="page"><p role="alert">{error}</p></div>;
  if (rows === null) return <div className="page cinema-loading" role="status">Preparando seu espaço…</div>;
  const feature = rows.flatMap((row) => row.items).find((item) => item.hasArtwork && item.kind !== "live") || rows.flatMap((row) => row.items)[0];
  if (!feature) return <div className="cinema-welcome"><p className="eyebrow">BEM-VINDO AO NOVA</p><h1>Seu próximo<br />grande momento.</h1><p>Conecte sua lista e transforme seu espaço em cinema.</p><button className="nova-button button-primary" onClick={() => navigate("sources")}>Conectar minha lista <ArrowRight size={18} /></button></div>;
  function choose(item: NativeCatalogItem) { if (item.kind === "series") setSelected(item); else start({ item }); }
  return <div className="cinema-home">
    <section className="cinema-feature" aria-label="Destaque da sua biblioteca">
      <NativeArtwork mediaId={feature.id} hasArtwork={feature.hasArtwork} className="cinema-feature-art" />
      <div className="cinema-feature-shade" />
      <div className="cinema-feature-copy"><p className="eyebrow">NOVA <span>•</span> {feature.kind === "series" ? "SÉRIES" : feature.kind === "live" ? "AO VIVO" : "SUA BIBLIOTECA"}</p><h1>{feature.name || "Título não fornecido"}</h1>
        <div className="cinema-meta">{[feature.year, feature.category, feature.duration, feature.rating].filter(Boolean).map((value, i) => <span key={i}>{value}</span>)}</div>
        {feature.description && <p className="cinema-synopsis">{feature.description}</p>}
        <div className="cinema-feature-actions"><button className="cinema-watch" onClick={() => choose(feature)}><Play size={20} fill="currentColor" /> {feature.kind === "series" ? "Ver episódios" : "Assistir agora"}</button><button className="cinema-info" onClick={() => setSelected(feature)}><Info size={20} /> Mais informações</button></div>
      </div>
      <span className="cinema-feature-index">DA SUA LISTA <span>01</span></span>
    </section>
    <div className="cinema-rows">{rows.filter((row) => row.items.length > 0).map((row) => <section className={`cinema-row cinema-row-${row.kind}`} key={row.kind}>
      <div className="cinema-row-heading"><h2>{row.kind === "live" && <Tv size={19} />}{row.title}</h2>{row.kind !== "unknown" && <button onClick={() => navigate(row.kind === "movie" ? "movies" : row.kind === "series" ? "series" : "live")}>Ver tudo <ArrowRight size={15} /></button>}</div>
      <div className="cinema-rail" aria-label={row.title}>{row.items.map((item) => <button key={item.id} className="cinema-poster" onClick={() => choose(item)} aria-label={`${item.kind === "series" ? "Ver episódios de" : "Reproduzir"} ${item.name || "conteúdo"}`}><div className="cinema-poster-image"><NativeArtwork mediaId={item.id} hasArtwork={item.hasArtwork} /><span className="cinema-poster-play"><Play size={22} fill="currentColor" /></span>{item.kind === "live" && <span className="cinema-live-badge">AO VIVO</span>}</div><strong>{item.name || "Nome não fornecido"}</strong><small>{item.year || item.category || ""}</small></button>)}</div>
    </section>)}</div>
    <NativeDetails item={selected} onClose={() => setSelected(null)} />
  </div>;
}
