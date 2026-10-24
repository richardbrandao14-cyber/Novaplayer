import { NativeCatalogBrowser } from "../components/native/NativeCatalogBrowser";
import { useState } from "react";
import { ArrowUpRight, Info, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { Carousel } from "../components/Carousel";
import { MediaDetails } from "../components/MediaDetails";
import { EmptyState } from "../components/EmptyState";
import { Artwork } from "../components/Artwork";
import { LoadState } from "../components/LoadState";
import { Button } from "../ui/Button";
function DemoHome() {
  const reducedMotion = useReducedMotion();
  const { items, status } = useCatalog();
  const { demo, search, favorites, navigate, historyIds } = useAppStore();
  const [details, setDetails] = useState(false);
  if (status !== "ready") return <LoadState status={status} />;
  if (!demo) return <EmptyState />;
  const feature = items.find((i) => i.id === "aurora");
  const movies = items.filter((i) =>
    i.title
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="page home-page">
      <section className="hero">
        <Artwork name="hero" className="hero-art" priority />
        <div className="hero-shade" />
        <motion.div
          className="hero-copy"
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          <p className="eyebrow">
            <Sparkles size={14} /> EM DESTAQUE NA DEMONSTRAÇÃO
          </p>
          <h1>
            Além da
            <br />
            <em>Aurora</em>
          </h1>
          <p className="hero-meta">
            2026 <span>Ficção científica</span> 1h 48min
          </p>
          <p className="hero-description">
            Algumas jornadas começam onde
            <br className="desktop-break" /> o universo parece terminar.
          </p>
          <div className="hero-actions">
            <Button onClick={() => setDetails(true)}>
              <Info size={17} />
              Conhecer a história
            </Button>
            <Button variant="ghost" onClick={() => navigate("movies")}>
              Explorar filmes <ArrowUpRight size={17} />
            </Button>
          </div>
          <p className="hero-disclaimer">
            Obra fictícia · Reprodução não disponível
          </p>
        </motion.div>
        <span className="hero-index">
          NOVA ORIGINAL <span>· DEMO</span>
        </span>
      </section>
      {search && <p role="status">Resultados locais para “{search}”</p>}
      <Carousel
        title="Continue de onde parou"
        description="Progresso ilustrativo · Nesta sessão"
        items={movies.filter((i) => historyIds.includes(i.id))}
      />
      <Carousel
        title="Filmes recentes"
        description="Novas perspectivas, histórias imaginárias"
        items={movies.filter((i) => i.kind === "movie")}
      />
      <Carousel
        title="Séries recentes"
        description="Universos para explorar, episódio a episódio"
        items={movies.filter((i) => i.kind === "series")}
      />
      <Carousel
        title="Canais favoritos"
        description="Sua seleção demonstrativa de TV ao vivo"
        items={movies.filter(
          (i) => i.kind === "live" && favorites.includes(i.id),
        )}
      />
      <Carousel
        title="Seus favoritos"
        description="Escolhas desta sessão"
        items={movies.filter(
          (i) => i.kind !== "live" && favorites.includes(i.id),
        )}
      />
      {feature && (
        <MediaDetails
          item={details ? feature : null}
          onClose={() => setDetails(false)}
        />
      )}
    </div>
  );
}

export default function Home() {
  const demo = useAppStore((s) => s.demo);
  return demo ? <DemoHome /> : <NativeCatalogBrowser title="Início" />;
}
