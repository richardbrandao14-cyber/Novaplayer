import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MonitorPlay, Info } from "lucide-react";
import type {
  CatalogKind,
  NativeCatalogItem,
  NativeCatalogPage,
  NativeSource,
} from "../../domain/native/types";
import {
  nativeApi,
  nativeAvailable,
  nativeError,
} from "../../integrations/native";
import { useAppStore } from "../../state/useAppStore";
import { PageHeading } from "../PageHeading";
import { DesktopRequired } from "./DesktopRequired";
import { NativeArtwork } from "./NativeArtwork";
import { NativeDetails } from "./NativeDetails";
import { Button } from "../../ui/Button";
const size = 60;
function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}
export function NativeCatalogBrowser({
  kind,
  title,
}: {
  kind?: CatalogKind;
  title: string;
}) {
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState<NativeSource[]>([]);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedKind, setSelectedKind] = useState("");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState("name");
  const { search, setSearch, navigate } = useAppStore();
  const queryText = useDebounced(search);
  const [result, setResult] = useState<{
    key: string;
    page: NativeCatalogPage;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [selected, setSelected] = useState<NativeCatalogItem | null>(null);
  const [channel, setChannel] = useState<NativeCatalogItem | null>(null);
  const filterKind = kind ?? (selectedKind || undefined);
  const key = JSON.stringify({
    ...(sourceId ? { sourceId } : {}),
    ...(filterKind ? { kind: filterKind } : {}),
    ...(category ? { category } : {}),
    ...(queryText ? { search: queryText } : {}),
    offset,
    limit: size,
    sort,
  });
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true;
    nativeApi
      .listSources()
      .then((list) => {
        if (active) setSources(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true;
    nativeApi
      .categories(filterKind, sourceId || undefined)
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [filterKind, sourceId]);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true;
    nativeApi
      .query(JSON.parse(key))
      .then((page) => {
        if (active) {
          setResult({ key, page });
          setFailure(null);
        }
      })
      .catch((e) => {
        if (active) setFailure({ key, message: nativeError(e) });
      });
    return () => {
      active = false;
    };
  }, [key]);
  if (!nativeAvailable()) return <DesktopRequired />;
  const data = result?.key === key ? result.page : null;
  const error = failure?.key === key ? failure.message : "";
  const selectedChannel =
    data?.items.find((item) => item.id === channel?.id) ??
    data?.items[0] ??
    null;
  return (
    <div className="page">
      <PageHeading
        title={title}
        eyebrow="CATÁLOGO REAL"
        description="Dados da sua fonte, consultados em páginas no banco local. Reprodução ainda não disponível."
      />
      <div className="library-tools native-library-tools">
        <label className="local-search">
          Buscar no catálogo
          <input
            aria-label="Buscar na página"
            value={search}
            placeholder="Título"
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="sort-control">
          Fonte
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setCategory("");
              setOffset(0);
            }}
          >
            <option value="">Todas as fontes</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        {!kind && (
          <label className="sort-control">
            Tipo
            <select
              value={selectedKind}
              onChange={(e) => {
                setSelectedKind(e.target.value);
                setCategory("");
                setOffset(0);
              }}
            >
              <option value="">Todos</option>
              <option value="live">Canais</option>
              <option value="movie">Filmes</option>
              <option value="series">Séries</option>
              <option value="unknown">Sem classificação</option>
            </select>
          </label>
        )}
        <label className="sort-control">
          Categoria
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas as categorias</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="sort-control">
          Ordenar por
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setOffset(0);
            }}
          >
            <option value="name">Nome A–Z</option>
            <option value="recent">Mais recentes</option>
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : !data ? (
        <p role="status">Consultando catálogo…</p>
      ) : (
        <>
          <p className="native-total">
            {data.total} registros encontrados ·{" "}
            {data.items.length ? offset + 1 : 0}–{offset + data.items.length}{" "}
            nesta página
          </p>
          {data.items.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhum registro encontrado</h2>
              <p>
                Verifique os filtros ou importe uma fonte em Minhas Listas.
                Playlists sem tipo confiável aparecem em Início → Sem
                classificação.
              </p>
              <Button variant="secondary" onClick={() => navigate("sources")}>
                Gerenciar fontes
              </Button>
            </div>
          ) : kind === "live" ? (
            <div className="live-layout">
              <div
                className="channel-list native-channel-list"
                aria-label="Canais reais desta página"
              >
                {data.items.map((item) => (
                  <button
                    key={item.id}
                    className={
                      item.id === selectedChannel?.id ? "selected" : ""
                    }
                    onClick={() => setChannel(item)}
                  >
                    <NativeArtwork
                      mediaId={item.id}
                      hasArtwork={item.hasArtwork}
                    />
                    <span>
                      <strong>{item.name || "Nome não fornecido"}</strong>
                      <small>
                        {item.category || "Categoria não informada"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <div className="player-placeholder">
                  <MonitorPlay size={42} />
                  <h2>{selectedChannel?.name || "Nome não fornecido"}</h2>
                  <p>Canal importado · Streaming não implementado</p>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(selectedChannel)}
                  >
                    <Info size={15} />
                    Detalhes do canal
                  </Button>
                </div>
                <p className="notice">
                  EPG real e reprodução serão integrados em fases posteriores.
                </p>
              </div>
            </div>
          ) : (
            <div className="media-grid">
              {data.items.map((item) => (
                <article className="media-card" key={item.id}>
                  <button
                    className="card-open"
                    aria-label={`Ver detalhes de ${item.name || "registro sem nome"}`}
                    onClick={() => setSelected(item)}
                  >
                    <NativeArtwork
                      mediaId={item.id}
                      hasArtwork={item.hasArtwork}
                    />
                    <span className="card-caption">
                      <strong>{item.name || "Nome não fornecido"}</strong>
                      <span>{item.category || "Categoria não informada"}</span>
                      <span>
                        {item.kind === "unknown"
                          ? "Tipo não informado pela fonte"
                          : item.kind === "series"
                            ? "Série"
                            : item.kind === "movie"
                              ? "Filme"
                              : "Canal"}
                      </span>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="native-pagination">
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - size))}
            >
              <ChevronLeft size={16} />
              Anterior
            </Button>
            <span>Página {Math.floor(offset / size) + 1}</span>
            <Button
              variant="secondary"
              disabled={data.nextOffset == null}
              onClick={() => {
                if (data.nextOffset != null) setOffset(data.nextOffset);
              }}
            >
              Próxima
              <ChevronRight size={16} />
            </Button>
          </div>
        </>
      )}
      <NativeDetails item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
