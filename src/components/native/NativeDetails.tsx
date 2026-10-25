import { usePlaybackStore } from "../../state/usePlaybackStore";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  NativeCatalogItem,
  NativeSeriesDetails,
} from "../../domain/native/types";
import { nativeApi, nativeError } from "../../integrations/native";
import { Modal } from "../../ui/Dialog";
import { NativeArtwork } from "./NativeArtwork";
function DetailsBody({ item, initialSeason, rememberSeason }: { item: NativeCatalogItem; initialSeason: string; rememberSeason: (value: string) => void }) {
  const start = usePlaybackStore((s) => s.start);
  const [details, setDetails] = useState<NativeSeriesDetails | null>(null);
  const [error, setError] = useState("");
  const [season, setSeason] = useState(initialSeason);

  useEffect(() => {
    if (item.kind !== "series") return;
    let active = true;
    nativeApi
      .series(item.id)
      .then((result) => {
        if (active) {
          setDetails(result);
          setSeason((current) => result.some((s) => String(s.id ?? s.number) === current) ? current : String(result[0]?.id ?? result[0]?.number ?? ""));
        }
      })
      .catch((e) => {
        if (active) setError(nativeError(e));
      });
    return () => {
      active = false;
    };
  }, [item.id, item.kind]);
  const selected = details?.find((s) => String(s.id ?? s.number) === season);
  return (
    <>
      <NativeArtwork
        mediaId={item.id}
        hasArtwork={item.hasArtwork}
        className="detail-art"
      />
      <div className="detail-meta">
        {[item.year, item.duration, item.category, item.rating]
          .filter(Boolean)
          .map((text, n) => (
            <span key={n}>{text}</span>
          ))}
      </div>
      <p className="detail-description">
        {item.description || "Sinopse não fornecida pela fonte."}
      </p>
      {item.kind !== "series" && <button className="nova-button button-primary" onClick={() => { start({ item }); }}><Play size={19} fill="currentColor" /> Assistir agora</button>}
      {item.kind === "unknown" && (
        <p className="notice">
          A fonte não forneceu classificação segura. Este registro foi
          preservado sem assumir que é canal, filme ou série.
        </p>
      )}
      {item.kind === "series" && (
        <section className="season-section series-seasons">
          <h3>Temporadas e episódios</h3>
          {error ? (
            <p role="alert">{error}</p>
          ) : details === null ? (
            <p role="status">Consultando detalhes da série…</p>
          ) : details.length === 0 ? (
            <p>Nenhuma temporada fornecida pelo servidor.</p>
          ) : (
            <>
              <label className="field" htmlFor="native-season">
                Temporada
              </label>
              <select
                id="native-season"
                value={season}
                onChange={(e) => { setSeason(e.target.value); rememberSeason(e.target.value); }}
              >
                {details.map((s) => (
                  <option
                    key={String(s.id ?? s.number)}
                    value={String(s.id ?? s.number)}
                  >
                    Temporada {s.number}
                  </option>
                ))}
              </select>
              <ol className="episode-list">
                {selected?.episodes.map((episode, index) => (
                  <li key={episode.id}>
                    <button className="episode-play-card" onClick={() => { start({ item, episodeId: episode.id, episodeTitle: episode.title || episode.name || "Título não fornecido", seasons: details ?? [] }); }} aria-label={`Reproduzir ${episode.title || episode.name || `episódio ${index + 1}`}`}>
                      <span className="episode-number">{index + 1}</span>
                      <span className="episode-preview"><Play size={25} fill="currentColor" /></span>
                      <span className="episode-copy"><strong>{episode.title || episode.name || "Título não informado"}</strong><span>{episode.description || "Descrição não fornecida."}</span>{episode.duration && <small>{episode.duration}</small>}</span>
                      <Play className="episode-play-icon" size={19} />
                    </button>
                  </li>
                ))}
              </ol>
              {selected?.episodes.length === 0 && (
                <p>Nenhum episódio fornecido para esta temporada.</p>
              )}
            </>
          )}
        </section>
      )}
      <p className="detail-footnote">
        Metadados fornecidos pela sua fonte. Nenhuma URL de reprodução é enviada
        à interface.
      </p>
    </>
  );
}
export function NativeDetails({
  item,
  onClose,
}: {
  item: NativeCatalogItem | null;
  onClose: () => void;
}) {
  const session = usePlaybackStore((s) => s.session);
  const [remembered, setRemembered] = useState<{ mediaId: string; season: string } | null>(null);
  return (
    <Modal
      size="wide"
      open={item !== null && session === null}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={item?.name || "Informação não fornecida"}
      description={item?.kind === "series" ? "Escolha a temporada e clique no episódio para assistir." : "Seu conteúdo, pronto para assistir."}
    >
      {item && <DetailsBody key={item.id} item={item} initialSeason={remembered?.mediaId === item.id ? remembered.season : ""} rememberSeason={(season) => setRemembered({ mediaId: item.id, season })} />}
    </Modal>
  );
}
