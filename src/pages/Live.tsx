import { NativeCatalogBrowser } from "../components/native/NativeCatalogBrowser";
import { useState, useDeferredValue } from "react";
import { MonitorPlay, Radio, CalendarDays } from "lucide-react";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { matchesMedia } from "../services/search";
import { PageHeading } from "../components/PageHeading";
import { EmptyState } from "../components/EmptyState";
import { LoadState } from "../components/LoadState";
import { ChannelList } from "../components/ChannelList";
function DemoLive() {
  const { items, status } = useCatalog();
  const { search, setSearch, demo } = useAppStore();
  const deferred = useDeferredValue(search);
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState("nova-live");
  const channels = items.filter((i) => i.kind === "live");
  const filtered = channels.filter(
    (i) =>
      (category === "Todos" || i.category === category) &&
      matchesMedia(i, deferred),
  );
  const current = filtered.find((i) => i.id === selected) ?? filtered[0];
  return (
    <div className="page">
      <PageHeading
        title="TV ao Vivo"
        description="Canais, descobertas e programação. Uma experiência inteiramente demonstrativa."
      />
      {status !== "ready" ? (
        <LoadState status={status} />
      ) : !demo ? (
        <EmptyState />
      ) : (
        <div className="tv-workspace">
          <aside className="live-categories" aria-label="Categorias de canais">
            <p className="eyebrow">CATEGORIAS</p>
            {["Todos", ...new Set(channels.map((i) => i.category))].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                <Radio size={15} />
                {c}
                <span>
                  {c === "Todos"
                    ? channels.length
                    : channels.filter((i) => i.category === c).length}
                </span>
              </button>
            ))}
          </aside>
          <div className="live-browser">
            <label className="field channel-search">
              Buscar canais
              <input
                aria-label="Buscar na página"
                placeholder="Nome ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <p className="channel-counter">
              {filtered.length} canais demonstrativos
            </p>
            <ChannelList
              key={category + deferred}
              items={filtered}
              selected={current?.id ?? ""}
              onSelect={setSelected}
            />
            <p className="keyboard-note">
              ↑ ↓ selecionam canais · Sem transmissão
            </p>
          </div>
          <div className="live-stage">
            <div className="player-placeholder">
              <span className="player-demo-label">
                NEX · DEMONSTRAÇÃO
              </span>
              <MonitorPlay size={42} />
              <h2>{current?.title ?? "Selecione um canal"}</h2>
              <p>Espaço reservado à reprodução nativa</p>
              <span className="badge">Streaming não implementado</span>
            </div>
            <div className="program-placeholder">
              <div className="section-heading">
                <h3>Guia de programação</h3>
                <CalendarDays size={16} />
              </div>
              <p className="muted">
                Horários e programas fictícios · EPG não conectado
              </p>
              <div className="epg-row current">
                <span>AGORA</span>
                <div>
                  <h4>Uma janela para novas descobertas</h4>
                  <p>Descrição ilustrativa do programa selecionado.</p>
                  <div className="epg-progress">
                    <span />
                  </div>
                </div>
              </div>
              <div className="epg-row">
                <span>A SEGUIR</span>
                <div>
                  <h4>Novos horizontes</h4>
                  <p>Exemplo de programação futura.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Live() {
  const demo = useAppStore((s) => s.demo);
  return demo ? (
    <DemoLive />
  ) : (
    <NativeCatalogBrowser kind="live" title="TV ao Vivo" />
  );
}
