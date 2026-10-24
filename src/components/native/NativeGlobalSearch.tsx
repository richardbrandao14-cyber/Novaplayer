import { useEffect, useRef, useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import {
  nativeApi,
  nativeAvailable,
  nativeError,
} from "../../integrations/native";
import { Modal } from "../../ui/Dialog";
import type { NativeCatalogItem } from "../../domain/native/types";
import { useAppStore } from "../../state/useAppStore";
import { NativeArtwork } from "./NativeArtwork";
export function NativeGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    query: string;
    items: NativeCatalogItem[];
    total: number;
  } | null>(null);
  const [failure, setFailure] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const navigate = useAppStore((s) => s.navigate);
  const setSearch = useAppStore((s) => s.setSearch);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!open || !nativeAvailable() || query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void nativeApi
        .query({ search: query, offset: 0, limit: 24 })
        .then((page) => {
          if (active) {
            setResult({ query, items: page.items, total: page.total });
            setFailure(null);
          }
        })
        .catch((e) => {
          if (active) setFailure({ query, message: nativeError(e) });
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query]);
  const items = result?.query === query ? result.items : [];
  const error = failure?.query === query ? failure.message : "";
  function choose(item: NativeCatalogItem) {
    navigate(
      item.kind === "series"
        ? "series"
        : item.kind === "movie"
          ? "movies"
          : item.kind === "live"
            ? "live"
            : "home",
    );
    setSearch(item.name ?? "");
    setOpen(false);
    setQuery("");
  }
  return (
    <>
      <button
        className="search-box global-search-trigger"
        aria-label="Buscar na biblioteca"
        aria-keyshortcuts="Control+k"
        onClick={() => {
          setOpen(true);
          setQuery("");
        }}
      >
        <Search size={17} />
        <span>Buscar no catálogo real</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setQuery("");
        }}
        title="Buscar na biblioteca"
        description="Busca paginada no catálogo local. Use as setas para navegar e Enter para abrir."
      >
        {!nativeAvailable() ? (
          <p className="notice">
            A busca real exige o aplicativo Windows. A prévia web não acessa
            catálogos nativos.
          </p>
        ) : (
          <>
            <label className="field" htmlFor="native-global-query">
              Busca global
            </label>
            <input
              id="native-global-query"
              data-autofocus
              className="global-query"
              type="search"
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  list.current
                    ?.querySelector<HTMLButtonElement>("button")
                    ?.focus();
                }
              }}
            />
            <div className="search-status" role="status">
              {error ||
                (query.trim().length < 2
                  ? "Digite pelo menos dois caracteres."
                  : result?.query !== query
                    ? "Consultando catálogo…"
                    : items.length
                      ? `${result.total} registros encontrados · Até 24 exibidos`
                      : "Nenhum resultado encontrado.")}
            </div>
            <div
              className="search-results"
              ref={list}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                  return;
                const buttons = Array.from(
                  list.current?.querySelectorAll<HTMLButtonElement>("button") ??
                    [],
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                if (index < 0) return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? buttons.length - 1
                      : e.key === "ArrowDown"
                        ? (index + 1) % buttons.length
                        : (index - 1 + buttons.length) % buttons.length;
                buttons[next]?.focus();
              }}
            >
              {(["live", "movie", "series", "unknown"] as const).map((kind) => {
                const group = items.filter((item) => item.kind === kind);
                return (
                  group.length > 0 && (
                    <section key={kind}>
                      <h3>
                        {kind === "live"
                          ? "Canais"
                          : kind === "movie"
                            ? "Filmes"
                            : kind === "series"
                              ? "Séries"
                              : "Sem classificação"}
                      </h3>
                      {group.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => choose(item)}
                          aria-label={`Abrir ${item.name || "registro sem nome"}`}
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
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </section>
                  )
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
