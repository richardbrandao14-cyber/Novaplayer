import { NativeCatalogBrowser } from "../components/native/NativeCatalogBrowser";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { PageHeading } from "../components/PageHeading";
import { CatalogView } from "../components/CatalogView";
import { EmptyState } from "../components/EmptyState";
import { LoadState } from "../components/LoadState";
function DemoFavorites() {
  const { items, status } = useCatalog();
  const { favorites, search } = useAppStore();
  const selected = items.filter(
    (i) =>
      favorites.includes(i.id) &&
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
  return demo ? (
    <DemoFavorites />
  ) : (
    <NativeCatalogBrowser title="Favoritos" collection="favorites" />
  );
}
