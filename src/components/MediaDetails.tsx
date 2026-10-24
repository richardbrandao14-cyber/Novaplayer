import { useState } from "react";
import { Play, Heart } from "lucide-react";
import type { MediaItem } from "../domain/types";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Artwork } from "./Artwork";
import { useAppStore } from "../state/useAppStore";
function DetailBody({ item }: { item: MediaItem }) {
  const [seasonId, setSeasonId] = useState(item.seasons?.[0]?.id ?? "");
  const [notice, setNotice] = useState(false);
  const favorite = useAppStore((s) => s.favorites.includes(item.id));
  const toggle = useAppStore((s) => s.toggleFavorite);
  const season = item.seasons?.find((s) => s.id === seasonId);
  return (
    <>
      <Artwork name={item.artwork} className="detail-art" priority />
      <div className="detail-meta">
        <span>{item.year}</span>
        <span>{item.duration}</span>
        <span>{item.category}</span>
        {item.rating && <span className="badge">{item.rating}</span>}
      </div>
      <p className="detail-description">{item.description}</p>
      <div className="detail-actions">
        <Button onClick={() => setNotice(true)}>
          <Play size={15} />
          Prévia de reprodução · Demo
        </Button>
        <Button
          variant="secondary"
          aria-label="Favorito nos detalhes"
          aria-pressed={favorite}
          onClick={() => toggle(item.id)}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Nos favoritos" : "Favoritar"}
        </Button>
      </div>
      {notice && (
        <p role="status" className="notice">
          Demonstração visual. Reprodução ainda não implementada; nenhum vídeo
          foi aberto.
        </p>
      )}
      {item.kind === "series" && (
        <section className="season-section">
          <label className="field" htmlFor="season-selector">
            Temporada
          </label>
          <select
            id="season-selector"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
          >
            {item.seasons?.map((s) => (
              <option key={s.id} value={s.id}>
                Temporada {s.number}
              </option>
            ))}
          </select>
          {!season?.episodes.length ? (
            <p className="notice">Nenhum episódio demonstrativo disponível.</p>
          ) : (
            <ol className="episode-list">
              {season.episodes.map((episode, index) => (
                <li key={episode.id}>
                  <span className="episode-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Artwork name={episode.artwork} />
                  <div>
                    <h3>{episode.title}</h3>
                    <p>{episode.description}</p>
                    <span>Temporada {season.number} · Ilustrativo</span>
                    <small>{episode.duration}</small>
                    {episode.progress !== undefined && (
                      <progress
                        value={episode.progress}
                        max="100"
                        aria-label={`Progresso demonstrativo de ${episode.title}`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <p className="detail-footnote">
        Metadados fictícios. Nenhum conteúdo de provedor foi importado.
      </p>
    </>
  );
}
export function MediaDetails({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  return (
    <Modal
      size="wide"
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={item?.title ?? "Detalhes"}
      description="Conteúdo fictício de demonstração. Reprodução indisponível nesta fase."
    >
      {item && <DetailBody key={item.id} item={item} />}
    </Modal>
  );
}
