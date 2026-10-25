import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Clapperboard,
  Grid2X2,
  Home,
  Layers,
  Search,
  Tag,
} from "lucide-react";
import { nativeApi, nativeError } from "../../integrations/native";
import {
  useCatalogFilters,
  type CatalogSection,
} from "../../state/useCatalogFilters";
import { useMediaNavigation } from "../../state/useMediaNavigation";
import { useAppStore } from "../../state/useAppStore";
import { Tip } from "../../ui/Tooltip";
export function CatalogSidebar({
  section,
  collapsed,
  onBack,
  onHome,
  onExpand,
}: {
  section: CatalogSection;
  collapsed: boolean;
  onBack: () => void;
  onHome: () => void;
  onExpand: () => void;
}) {
  const filters = useCatalogFilters((s) => s[section]);
  const update = useCatalogFilters((s) => s.update);
  const [response, setResponse] = useState<{
    key: string;
    items: string[];
    error: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLButtonElement>(null);
  const title = section === "movie" ? "Filmes" : "Séries";
  const Icon = section === "movie" ? Clapperboard : Layers;
  const key = `${section}:${filters.sourceId}`;
  useEffect(() => {
    heading.current?.focus();
  }, [section]);
  useEffect(() => {
    let active = true;
    nativeApi
      .categories(section, filters.sourceId || undefined)
      .then((items) => {
        if (active) setResponse({ key, items, error: "" });
      })
      .catch((e) => {
        if (active) setResponse({ key, items: [], error: nativeError(e) });
      });
    return () => {
      active = false;
    };
  }, [section, filters.sourceId, key, retry]);
  const result = response?.key === key ? response : null;
  function choose(category: string) {
    useMediaNavigation.getState().close();
    useAppStore.getState().setSearch("");
    update(section, { category, offset: 0 });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <>
      <div className="catalog-side-controls">
        <Tip label="Voltar ao menu principal" enabled={collapsed}>
          <button
            ref={heading}
            className="nav-item"
            aria-label="Voltar ao menu principal"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
            <span>Menu principal</span>
          </button>
        </Tip>
        <Tip label="Ir para o Início" enabled={collapsed}>
          <button
            className="nav-item"
            aria-label="Ir para o Início"
            onClick={onHome}
          >
            <Home size={19} />
            <span>Início</span>
          </button>
        </Tip>
      </div>
      {collapsed ? (
        <Tip label={`Expandir categorias de ${title}`} enabled>
          <button
            className="nav-item active"
            aria-label={`Expandir categorias de ${title}`}
            onClick={onExpand}
          >
            <Icon size={19} />
          </button>
        </Tip>
      ) : (
        <>
          <div className="catalog-side-heading">
            <Icon size={17} />
            <h2>{title}</h2>
            <span>{result?.items.length ?? "…"}</span>
          </div>
          <label className="catalog-side-search">
            <Search size={14} />
            <input
              aria-label={`Filtrar categorias de ${title}`}
              placeholder="Encontrar categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div
            className="catalog-side-list"
            aria-label={`Categorias de ${title}`}
          >
            <button
              className={`nav-item ${!filters.category ? "active" : ""}`}
              aria-pressed={!filters.category}
              onClick={() => choose("")}
            >
              <Grid2X2 size={17} />
              <span>
                {section === "movie" ? "Todos os filmes" : "Todas as séries"}
              </span>
            </button>
            {!result ? (
              <p role="status">Carregando categorias…</p>
            ) : result.error ? (
              <div className="catalog-side-error" role="alert">
                <p>{result.error}</p>
                <button onClick={() => setRetry((v) => v + 1)}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              result.items
                .filter((name) =>
                  name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                )
                .map((name) => (
                  <button
                    key={name}
                    className={`nav-item ${filters.category === name ? "active" : ""}`}
                    aria-pressed={filters.category === name}
                    onClick={() => choose(name)}
                  >
                    <Tag size={15} />
                    <span>{name}</span>
                  </button>
                ))
            )}
            {result &&
              !result.error &&
              (result.items.length === 0 ? (
                <p>A fonte não forneceu subcategorias.</p>
              ) : (
                search &&
                !result.items.some((name) =>
                  name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                ) && <p>Nenhuma categoria encontrada.</p>
              ))}
          </div>
        </>
      )}
    </>
  );
}
