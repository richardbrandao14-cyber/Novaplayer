import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "../domain/types";
import { MediaCard } from "./MediaCard";
import { MediaDetails } from "./MediaDetails";
export function Carousel({
  title,
  items,
  description,
}: {
  title: string;
  items: readonly MediaItem[];
  description: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  function scroll(direction: number) {
    const el = track.current;
    if (el)
      el.scrollBy({
        left: direction * el.clientWidth * 0.8,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  return (
    <section className="shelf" aria-label={title}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="carousel-controls">
          <button
            className="icon-button"
            aria-label={`Anterior: ${title}`}
            disabled={items.length === 0}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={`Próximo: ${title}`}
            disabled={items.length === 0}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        className="carousel-track"
        ref={track}
        tabIndex={items.length ? 0 : undefined}
        aria-label={`Carrossel: ${title}`}
      >
        {items.map((item) => (
          <MediaCard key={item.id} item={item} onSelect={setSelected} />
        ))}
      </div>
      {!items.length && (
        <p className="inline-empty">
          Nenhum item nesta seção. Explore o catálogo e marque seus favoritos.
        </p>
      )}
      <MediaDetails item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
