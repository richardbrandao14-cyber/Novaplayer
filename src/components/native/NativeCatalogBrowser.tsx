import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Play,
  Radio,
  Search,
  Square,
  Tv,
} from "lucide-react";
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
import { usePlaybackStore } from "../../state/usePlaybackStore";
import {
  useLibraryRevision,
  useMediaNavigation,
} from "../../state/useMediaNavigation";
import { NativeArtwork } from "./NativeArtwork";
import { DesktopRequired } from "./DesktopRequired";
const size = 60;
function useBrowse(
  kind?: CatalogKind,
  collection?: "favorites" | "watchlist" | "continue",
) {
  const [sources, setSources] = useState<NativeSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState("name");
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const [queryText, setQueryText] = useState(search);
  const [result, setResult] = useState<{
    key: string;
    data: NativeCatalogPage;
  } | null>(null);
  const [error, setError] = useState("");
  const revision = useLibraryRevision((s) => s.revision);
  useEffect(() => {
    if (search === queryText) return;
    const timer = setTimeout(() => {
      setQueryText(search);
      setOffset(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [search, queryText]);
  useEffect(() => {
    let active = true;
    nativeApi
      .listSources()
      .then((value) => {
        if (active) setSources(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    nativeApi
      .categories(kind, sourceId || undefined)
      .then((value) => {
        if (active) setCategories(value);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [kind, sourceId]);
  const query = {
    ...(kind ? { kind } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(category ? { category } : {}),
    ...(queryText ? { search: queryText } : {}),
    ...(collection ? { collection } : {}),
    offset,
    limit: size,
    sort,
  };
  const key = JSON.stringify(query);
  useEffect(() => {
    let active = true;
    nativeApi
      .query(JSON.parse(key))
      .then((data) => {
        if (active) {
          setResult({ key, data });
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(nativeError(e));
      });
    return () => {
      active = false;
    };
  }, [key, revision]);
  return {
    sources,
    sourceId,
    changeSource: (id: string) => {
      setSourceId(id);
      setCategory("");
      setOffset(0);
    },
    categories,
    category,
    changeCategory: (value: string) => {
      setCategory(value);
      setOffset(0);
    },
    offset,
    setOffset,
    sort,
    setSort,
    search,
    setSearch,
    data: result?.key === key ? result.data : null,
    error,
  };
}
type Browse = ReturnType<typeof useBrowse>;
function SourceSearch({ model, title }: { model: Browse; title: string }) {
  return (
    <header className="browse-header">
      <div>
        <p className="eyebrow">EXPLORE SEU UNIVERSO</p>
        <h1>{title}</h1>
      </div>
      <div className="browse-search">
        <Search size={17} />
        <input
          aria-label={`Buscar em ${title}`}
          placeholder="O que você quer assistir?"
          value={model.search}
          onChange={(e) => model.setSearch(e.target.value)}
        />
      </div>
      {model.sources.length > 1 && (
        <select
          aria-label="Fonte do catálogo"
          value={model.sourceId}
          onChange={(e) => model.changeSource(e.target.value)}
        >
          <option value="">Todas as fontes</option>
          {model.sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      )}
    </header>
  );
}
function Categories({
  model,
  vertical = false,
}: {
  model: Browse;
  vertical?: boolean;
}) {
  return (
    <nav
      className={vertical ? "browse-categories vertical" : "browse-categories"}
      aria-label="Subcategorias"
    >
      <button
        className={!model.category ? "active" : ""}
        aria-pressed={!model.category}
        onClick={() => model.changeCategory("")}
      >
        Todos
      </button>
      {model.categories.map((name) => (
        <button
          key={name}
          className={model.category === name ? "active" : ""}
          aria-pressed={model.category === name}
          onClick={() => model.changeCategory(name)}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}
function Paging({ model }: { model: Browse }) {
  return (
    <div className="browse-paging">
      <button
        disabled={model.offset === 0}
        onClick={() => model.setOffset(Math.max(0, model.offset - size))}
      >
        <ChevronLeft size={17} /> Anterior
      </button>
      <span>Página {Math.floor(model.offset / size) + 1}</span>
      <button
        disabled={model.data?.nextOffset == null}
        onClick={() => {
          if (model.data?.nextOffset != null)
            model.setOffset(model.data.nextOffset);
        }}
      >
        Próxima <ChevronRight size={17} />
      </button>
    </div>
  );
}
export function NativeCatalogBrowser({
  kind,
  title,
  collection,
}: {
  kind?: CatalogKind;
  title: string;
  collection?: "favorites" | "watchlist" | "continue";
}) {
  if (!nativeAvailable()) return <DesktopRequired />;
  return kind === "live" ? (
    <LiveWorkspace />
  ) : (
    <MediaCatalog
      key={`${kind}:${collection}`}
      kind={kind}
      title={title}
      collection={collection}
    />
  );
}
function MediaCatalog({
  kind,
  title,
  collection,
}: {
  kind: CatalogKind | undefined;
  title: string;
  collection: "favorites" | "watchlist" | "continue" | undefined;
}) {
  const model = useBrowse(kind, collection);
  const open = useMediaNavigation((s) => s.open);
  const start = usePlaybackStore((s) => s.start);
  const navigate = useAppStore((s) => s.navigate);
  function choose(item: NativeCatalogItem) {
    if (item.kind === "live") {
      navigate("live");
      start({ item, mode: "docked" });
    } else open(item);
  }
  const feature =
    model.data?.items.find((item) => item.hasArtwork) || model.data?.items[0];
  return (
    <div className="media-browse-page">
      <SourceSearch model={model} title={title} />
      <Categories model={model} />
      {model.error && (
        <p role="alert" className="notice">
          {model.error}
        </p>
      )}
      {feature && !model.search && !collection && (
        <section className="browse-feature">
          <NativeArtwork
            mediaId={feature.id}
            hasArtwork={feature.hasArtwork}
            className="browse-feature-art"
          />
          <div className="browse-feature-shade" />
          <div>
            <p className="eyebrow">{model.category || "NA SUA BIBLIOTECA"}</p>
            <h2>{feature.name || "Título não fornecido"}</h2>
            <p className="cinema-meta">
              {[feature.year, feature.category, feature.duration]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {feature.description && (
              <p className="cinema-synopsis">{feature.description}</p>
            )}
            <button className="cinema-watch" onClick={() => choose(feature)}>
              {kind === "series" ? "Explorar episódios" : "Conhecer o filme"}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}
      <div className="browse-section-heading">
        <h2>
          {model.category ||
            (collection ? title : "Encontre sua próxima história")}
        </h2>
        {model.data && <span>{model.data.total} títulos</span>}
        <select
          aria-label="Ordenar catálogo"
          value={model.sort}
          onChange={(e) => {
            model.setSort(e.target.value);
            model.setOffset(0);
          }}
        >
          <option value="name">A–Z</option>
          <option value="recent">Ano</option>
        </select>
      </div>
      {!model.data ? (
        <div
          className="browse-skeleton"
          role="status"
          aria-label="Carregando catálogo"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} />
          ))}
        </div>
      ) : model.data.items.length ? (
        <div className="browse-poster-grid">
          {model.data.items.map((item) => (
            <button
              className="cinema-poster"
              key={item.id}
              onClick={() => choose(item)}
              aria-label={`Ver detalhes de ${item.name || "registro sem nome"}`}
            >
              <div className="cinema-poster-image">
                <NativeArtwork mediaId={item.id} hasArtwork={item.hasArtwork} />
                <span className="cinema-poster-play">
                  <Play size={24} fill="currentColor" />
                </span>
              </div>
              <strong>{item.name || "Nome não fornecido"}</strong>
              <small>
                {item.year ||
                  item.category ||
                  (item.kind === "unknown"
                    ? "Tipo não informado pela fonte"
                    : "")}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="browse-empty">
          <h2>Nenhum título encontrado</h2>
          <p>
            Experimente outra categoria ou adicione conteúdos à sua coleção.
          </p>
        </div>
      )}
      {model.data && <Paging model={model} />}
    </div>
  );
}
function LiveWorkspace() {
  const model = useBrowse("live");
  const session = usePlaybackStore((s) => s.session);
  const start = usePlaybackStore((s) => s.start);
  const setMode = usePlaybackStore((s) => s.setMode);
  const close = usePlaybackStore((s) => s.close);
  const current = session?.item.kind === "live" ? session.item : null;
  function choose(item: NativeCatalogItem) {
    if (current?.id === item.id) setMode("theater", true);
    else start({ item, mode: "docked" });
  }
  return (
    <div className="live-browse-page">
      <SourceSearch model={model} title="TV ao Vivo" />
      {model.error && (
        <p role="alert" className="notice">
          {model.error}
        </p>
      )}
      <div className="live-browse-workspace">
        <aside className="live-browse-categories">
          <h2>Categorias</h2>
          <Categories model={model} vertical />
        </aside>
        <section className="live-browse-channels">
          <header>
            <Radio size={16} />
            <strong>{model.category || "Todos os canais"}</strong>
            <span>{model.data?.total ?? "…"}</span>
          </header>
          <div className="live-channel-scroll" aria-label="Lista de canais">
            {model.data ? (
              model.data.items.map((item) => (
                <button
                  key={item.id}
                  className={`live-channel-row ${current?.id === item.id ? "active" : ""}`}
                  onClick={() => choose(item)}
                  aria-label={`${current?.id === item.id ? "Ampliar" : "Prévia de"} ${item.name || "canal"}`}
                >
                  <NativeArtwork
                    mediaId={item.id}
                    hasArtwork={item.hasArtwork}
                  />
                  <span>
                    <strong>{item.name || "Nome não fornecido"}</strong>
                    <small>{item.category || "Categoria não informada"}</small>
                  </span>
                  {current?.id === item.id ? (
                    <span className="on-air-dot" />
                  ) : (
                    <Play size={14} />
                  )}
                </button>
              ))
            ) : (
              <p role="status">Carregando canais…</p>
            )}
            {model.data?.items.length === 0 && (
              <p>Nenhum canal nesta categoria.</p>
            )}
          </div>
          <Paging model={model} />
        </section>
        <section className="live-browse-preview">
          <div id="live-preview-slot" className="live-preview-slot">
            {!current && (
              <div className="live-preview-welcome">
                <Tv size={42} />
                <h2>O que está passando agora?</h2>
                <p>
                  Escolha um canal para assistir aqui enquanto explora as
                  opções.
                </p>
              </div>
            )}
          </div>
          <div className="live-preview-caption">
            <div>
              <p className="eyebrow">
                {current ? "AO VIVO AGORA" : "SEU ESPAÇO AO VIVO"}
              </p>
              <h2>{current?.name || "Escolha um canal"}</h2>
              {current?.category && <p>{current.category}</p>}
            </div>
            {current && (
              <>
                <button aria-label="Parar prévia" onClick={close}>
                  <Square size={17} />
                </button>
                <button
                  className="cinema-watch"
                  onClick={() => setMode("theater", true)}
                >
                  <Maximize size={17} /> Tela cheia
                </button>
              </>
            )}
          </div>
          <p className="live-browse-hint">
            Primeiro clique: prévia aqui. Clique novamente no mesmo canal para
            ampliar. Continue navegando pelas categorias e canais.
          </p>
        </section>
      </div>
    </div>
  );
}
