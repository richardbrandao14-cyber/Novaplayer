import { NativeGlobalSearch } from "./native/NativeGlobalSearch";
import { useEffect, useRef, useState, useDeferredValue, useMemo } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Modal } from "../ui/Dialog";
import { useCatalog } from "../services/useCatalog";
import { searchMedia } from "../services/search";
import { useAppStore } from "../state/useAppStore";
import type { MediaItem } from "../domain/types";
import { Artwork } from "./Artwork";
function DemoGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const { items, status } = useCatalog();
  const navigate = useAppStore((s) => s.navigate);
  const setSearch = useAppStore((s) => s.setSearch);
  const results = useMemo(
    () => searchMedia(items, deferred),
    [items, deferred],
  );
  const list = useRef<HTMLDivElement>(null);
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) setQuery("");
  }
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function choose(item: MediaItem) {
    navigate(
      item.kind === "movie"
        ? "movies"
        : item.kind === "series"
          ? "series"
          : "live",
    );
    setSearch(item.title);
    changeOpen(false);
  }
  return (
    <>
      <button
        className="search-box global-search-trigger"
        aria-label="Buscar na biblioteca"
        aria-keyshortcuts="Control+k"
        onClick={() => changeOpen(true)}
      >
        <Search size={17} />
        <span>O que você quer descobrir?</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Modal
        open={open}
        onOpenChange={changeOpen}
        title="Buscar na biblioteca"
        description="Pesquise filmes, séries e canais fictícios. Use as setas para navegar e Enter para abrir."
      >
        <label className="field" htmlFor="global-query">
          Busca global
        </label>
        <input
          id="global-query"
          data-autofocus
          className="global-query"
          type="search"
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              list.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
          }}
        />
        <div role="status" className="search-status">
          {status === "error"
            ? "A busca está indisponível. Reabra a interface para tentar novamente."
            : !query
              ? "Comece pelo título ou pela categoria."
              : results.length
                ? `${results.length} resultados demonstrativos`
                : "Nenhum resultado encontrado."}
        </div>
        <div
          className="search-results"
          ref={list}
          onKeyDown={(e) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
              return;
            const buttons = Array.from(
              list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
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
          {(["movie", "series", "live"] as const).map((kind) => {
            const group = results.filter((i) => i.kind === kind);
            return (
              group.length > 0 && (
                <section key={kind}>
                  <h3>
                    {kind === "movie"
                      ? "Filmes"
                      : kind === "series"
                        ? "Séries"
                        : "TV ao Vivo"}
                  </h3>
                  {group.map((item) => (
                    <button
                      key={item.id}
                      aria-label={`Abrir ${item.title} em ${kind === "movie" ? "Filmes" : kind === "series" ? "Séries" : "TV ao Vivo"}`}
                      onClick={() => choose(item)}
                    >
                      <Artwork name={item.artwork} />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.category} · Demonstração</small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              )
            );
          })}
        </div>
      </Modal>
    </>
  );
}

export function GlobalSearch() {
  const demo = useAppStore((s) => s.demo);
  return demo ? <DemoGlobalSearch /> : <NativeGlobalSearch />;
}
