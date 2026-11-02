import { useState } from "react";
import { Film, Layers, Tv, LayoutGrid } from "lucide-react";
import type { CatalogKind } from "../domain/native/types";
import type { ReactNode } from "react";
import { NativeCatalogBrowser } from "../components/native/NativeCatalogBrowser";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { PageHeading } from "../components/PageHeading";
import { CatalogView } from "../components/CatalogView";
import { EmptyState } from "../components/EmptyState";
import { LoadState } from "../components/LoadState";
function DemoFavorites({ kind, filterBar }: { kind?: CatalogKind; filterBar: ReactNode }) {
  const { items, status } = useCatalog();
  const { favorites, search } = useAppStore();
  const selected = items.filter(
    (i) =>
      favorites.includes(i.id) && (!kind || i.kind === kind) &&
      i.title
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="page">
      <PageHeading
        title="Favoritos"
        description="As histórias que você quer manter por perto. Alterações demonstrativas valem nesta sessão."
      />
      {filterBar}
      {status !== "ready" ? (
        <LoadState status={status} />
      ) : selected.length ? (
        <CatalogView items={selected} />
      ) : (
        <EmptyState
          title="Sua coleção está esperando"
          detail="Marque o coração nos cartões demonstrativos para organizar seus favoritos."
        />
      )}
    </div>
  );
}

export default function Favorites() {
  const demo = useAppStore((s) => s.demo);
  const [kind, setKind] = useState<CatalogKind | undefined>();
  const filterBar = <div className="collection-kinds" role="group" aria-label="Tipo de favorito">
    {([{id:undefined,label:"Todos",icon:LayoutGrid},{id:"movie",label:"Filmes",icon:Film},{id:"series",label:"Séries",icon:Layers},{id:"live",label:"TV ao vivo",icon:Tv}] as const).map(({id,label,icon:Icon}) => <button key={id || "all"} aria-pressed={kind === id} onClick={() => setKind(id)}><Icon size={17}/>{label}</button>)}
  </div>;
  return demo ? <DemoFavorites {...(kind ? { kind } : {})} filterBar={filterBar}/> : <NativeCatalogBrowser title="Favoritos" collection="favorites" {...(kind ? { kind } : {})} filterBar={filterBar}/>;
}
