import { useEffect, useState } from "react";
import type {
  NativeCatalogItem,
  NativeSeriesDetails,
} from "../../domain/native/types";
import { nativeApi, nativeError } from "../../integrations/native";
import { Modal } from "../../ui/Dialog";
import { NativeArtwork } from "./NativeArtwork";
function DetailsBody({ item }: { item: NativeCatalogItem }) {
  const [details, setDetails] = useState<NativeSeriesDetails | null>(null);
  const [error, setError] = useState("");
  const [season, setSeason] = useState("");
  useEffect(() => {
    if (item.kind !== "series") return;
    let active = true;
    nativeApi
      .series(item.id)
      .then((result) => {
        if (active) {
          setDetails(result);
          setSeason(String(result[0]?.id ?? result[0]?.number ?? ""));
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
      <p className="notice">
        Catálogo importado. Reprodução de vídeo não implementada nesta fase.
      </p>
      {item.kind === "unknown" && (
        <p className="notice">
          A fonte não forneceu classificação segura. Este registro foi
          preservado sem assumir que é canal, filme ou série.
        </p>
      )}
      {item.kind === "series" && (
        <section className="season-section">
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
                onChange={(e) => setSeason(e.target.value)}
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
                    <span className="episode-number">{index + 1}</span>
                    <div>
                      <h3>
                        {episode.title ||
                          episode.name ||
                          "Título não informado"}
                      </h3>
                      <p>{episode.description || "Descrição não fornecida."}</p>
                      {episode.duration && <small>{episode.duration}</small>}
                    </div>
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
  return (
    <Modal
      size="wide"
      open={item !== null}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={item?.name || "Informação não fornecida"}
      description="Detalhes do catálogo real. Reprodução indisponível nesta fase."
    >
      {item && <DetailsBody key={item.id} item={item} />}
    </Modal>
  );
}
