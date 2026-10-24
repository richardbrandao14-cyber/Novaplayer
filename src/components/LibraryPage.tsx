import { NativeCatalogBrowser } from "./native/NativeCatalogBrowser";
import { useState, useDeferredValue } from "react";
import type { MediaKind } from "../domain/types";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { PageHeading } from "./PageHeading";
import { CatalogView } from "./CatalogView";
import { EmptyState } from "./EmptyState";
import { LoadState } from "./LoadState";
import { matchesMedia } from "../services/search";
function DemoLibraryPage({
  kind,
  title,
  description,
}: {
  kind: MediaKind;
  title: string;
  description: string;
}) {
  const { items, status } = useCatalog();
  const { demo, search } = useAppStore();
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("recent");
  const deferred = useDeferredValue(search);
  const setSearch = useAppStore((s) => s.setSearch);
  if (status !== "ready") return <LoadState status={status} />;
  const catalog = items.filter((i) => i.kind === kind);
  const categories = ["Todos", ...new Set(catalog.map((i) => i.category))];
  const filtered = catalog
    .filter(
      (i) =>
        (category === "Todos" || i.category === category) &&
        matchesMedia(i, deferred),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "pt-BR")
        : b.year.localeCompare(a.year) || a.id.localeCompare(b.id),
    );
  return (
    <div className="page">
      <PageHeading title={title} description={description} />
      {!demo ? (
        <EmptyState />
      ) : (
        <>
          <div className="library-tools">
            <label className="local-search">
              Buscar no catálogo
              <input
                aria-label="Buscar na página"
                placeholder="Título ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="sort-control">
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Mais recentes</option>
                <option value="title">Título A–Z</option>
              </select>
            </label>
          </div>
          <div className="filter-row" aria-label="Filtrar por categoria">
            {categories.map((c) => (
              <button
                className={c === category ? "chip selected" : "chip"}
                key={c}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
            <span className="result-count">
              {filtered.length} títulos demonstrativos
            </span>
          </div>
          <CatalogView items={filtered} />
          {!filtered.length && (
            <p className="notice">
              Nenhum título corresponde à busca ou categoria.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function LibraryPage(props: {
  kind: MediaKind;
  title: string;
  description: string;
}) {
  const demo = useAppStore((s) => s.demo);
  return demo ? (
    <DemoLibraryPage {...props} />
  ) : (
    <NativeCatalogBrowser kind={props.kind} title={props.title} />
  );
}
