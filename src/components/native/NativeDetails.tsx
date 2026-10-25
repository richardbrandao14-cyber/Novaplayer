import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, Check, Heart, Play, Plus, RotateCcw } from "lucide-react";
import { usePlaybackStore } from "../../state/usePlaybackStore";
import { useLibraryRevision } from "../../state/useMediaNavigation";
import type {
  NativeCatalogItem,
  NativeLibraryState,
  NativeSeriesDetails,
} from "../../domain/native/types";
import { nativeApi, nativeError } from "../../integrations/native";
import { NativeArtwork } from "./NativeArtwork";
import { EpisodeThumbnail } from "./EpisodeThumbnail";
const empty: NativeLibraryState = {
  favorite: false,
  watchlist: false,
  position: 0,
  duration: 0,
  episodeId: null,
};
function time(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function NativeDetails({
  item,
  onClose,
}: {
  item: NativeCatalogItem | null;
  onClose: () => void;
}) {
  return item ? (
    <DetailsPage key={item.id} item={item} onClose={onClose} />
  ) : null;
}
function DetailsPage({
  item,
  onClose,
}: {
  item: NativeCatalogItem;
  onClose: () => void;
}) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const start = usePlaybackStore((s) => s.start);
  const session = usePlaybackStore((s) => s.session);
  const revision = useLibraryRevision((s) => s.revision);
  const bump = useLibraryRevision((s) => s.bump);
  const [library, setLibrary] = useState<NativeLibraryState>(empty);
  const [libraryReady, setLibraryReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<NativeSeriesDetails | null>(null);
  const [error, setError] = useState("");
  const [season, setSeason] = useState("");
  useEffect(() => {
    if (session) return;
    let active = true;
    nativeApi
      .library(item.id)
      .then((value) => {
        if (active) {
          setLibrary(value);
          setLibraryReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(nativeError(e));
      });
    return () => {
      active = false;
    };
  }, [item.id, session, revision]);
  useEffect(() => {
    if (item.kind !== "series") return;
    let active = true;
    nativeApi
      .series(item.id)
      .then((value) => {
        if (active) {
          setDetails(value);
          setSeason(String(value[0]?.id ?? value[0]?.number ?? ""));
        }
      })
      .catch((e) => {
        if (active) {
          setDetails([]);
          setError(nativeError(e));
        }
      });
    return () => {
      active = false;
    };
  }, [item.id, item.kind]);
  async function save(favorite: boolean, watchlist: boolean) {
    setSaving(true);
    setError("");
    try {
      setLibrary(await nativeApi.setLibrary(item.id, favorite, watchlist));
      bump();
    } catch (e) {
      setError(nativeError(e));
    } finally {
      setSaving(false);
    }
  }
  const current = details?.find((s) => String(s.id ?? s.number) === season);
  const canResume =
    library.position >= 5 && library.duration - library.position > 15;
  function watch(episodeId?: string, episodeTitle?: string, resume = false) {
    start({
      item,
      ...(episodeId ? { episodeId } : {}),
      ...(episodeTitle ? { episodeTitle } : {}),
      ...(details ? { seasons: details } : {}),
      resume,
    });
  }
  return (
    <article
      className="media-detail-page"
      aria-label={`Detalhes de ${item.name || "conteúdo"}`}
    >
      <button className="detail-page-back" onClick={onClose}>
        <ArrowLeft size={18} /> Voltar à biblioteca
      </button>
      <section className="detail-page-hero">
        <NativeArtwork
          mediaId={item.id}
          hasArtwork={item.hasArtwork}
          className="detail-page-backdrop"
        />
        <div className="detail-page-shade" />
        <div className="detail-page-copy">
          <p className="eyebrow">
            NOVA •{" "}
            {item.kind === "series"
              ? "SÉRIE"
              : item.kind === "movie"
                ? "FILME"
                : "CONTEÚDO"}
          </p>
          <h1>{item.name || "Título não fornecido"}</h1>
          <div className="cinema-meta">
            {[item.year, item.category, item.duration, item.rating]
              .filter(Boolean)
              .map((text, i) => (
                <span key={i}>{text}</span>
              ))}
          </div>
          {item.description && (
            <p className="cinema-synopsis">{item.description}</p>
          )}
          <div className="detail-page-actions">
            {item.kind !== "series" ? (
              <button
                className="cinema-watch"
                onClick={() => watch(undefined, undefined, canResume)}
              >
                <Play size={19} fill="currentColor" />
                {canResume
                  ? `Continuar de ${time(library.position)}`
                  : "Assistir agora"}
              </button>
            ) : (
              canResume &&
              library.episodeId && (
                <button
                  className="cinema-watch"
                  onClick={() =>
                    watch(library.episodeId || undefined, undefined, true)
                  }
                >
                  <Play size={19} fill="currentColor" /> Continuar série
                </button>
              )
            )}
            <button
              className={`detail-save ${library.favorite ? "active" : ""}`}
              disabled={!libraryReady || saving}
              aria-pressed={library.favorite}
              onClick={() => void save(!library.favorite, library.watchlist)}
            >
              <Heart
                size={19}
                fill={library.favorite ? "currentColor" : "none"}
              />
              {library.favorite ? "Favoritado" : "Favoritar"}
            </button>
            <button
              className={`detail-save ${library.watchlist ? "active" : ""}`}
              disabled={!libraryReady || saving}
              aria-pressed={library.watchlist}
              onClick={() => void save(library.favorite, !library.watchlist)}
            >
              {library.watchlist ? <Check size={19} /> : <Plus size={19} />}
              {library.watchlist ? "Na Minha Lista" : "Minha Lista"}
            </button>
            {item.kind !== "series" && canResume && (
              <button className="detail-start-over" onClick={() => watch()}>
                <RotateCcw size={15} /> Assistir do início
              </button>
            )}
          </div>
          {canResume && (
            <div className="detail-resume">
              <progress
                max={library.duration}
                value={library.position}
                aria-label="Progresso salvo"
              />
              <small>{time(library.position)} assistidos</small>
            </div>
          )}
        </div>
      </section>
      {error && (
        <p className="notice detail-page-error" role="alert">
          {error}
        </p>
      )}
      {item.kind === "series" && (
        <section className="series-episode-section">
          <div className="series-season-heading">
            <h2>Episódios</h2>
            <label>
              Temporada
              <select
                aria-label="Temporada"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                {details?.map((s) => (
                  <option
                    key={s.id ?? s.number}
                    value={String(s.id ?? s.number)}
                  >
                    Temporada {s.number}
                  </option>
                ))}
              </select>
            </label>
            {current && <span>{current.episodes.length} episódios</span>}
          </div>
          {details === null ? (
            <p role="status">Carregando temporadas…</p>
          ) : !current?.episodes.length ? (
            <p>Nenhum episódio fornecido nesta temporada.</p>
          ) : (
            <div className="series-episode-grid">
              {current.episodes.map((episode, index) => {
                const resume = library.episodeId === episode.id && canResume;
                return (
                  <button
                    className="series-episode-tile"
                    key={episode.id}
                    onClick={() =>
                      watch(
                        episode.id,
                        episode.title || episode.name || "Título não fornecido",
                        resume,
                      )
                    }
                    aria-label={`Reproduzir ${episode.title || episode.name || `episódio ${index + 1}`}`}
                  >
                    <div className="series-episode-scene">
                      <EpisodeThumbnail
                        mediaId={item.id}
                        episodeId={episode.id}
                      />
                      <span className="series-episode-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="series-episode-play">
                        <Play size={25} fill="currentColor" />
                      </span>
                      {resume && (
                        <progress
                          max={library.duration}
                          value={library.position}
                          aria-label="Progresso do episódio"
                        />
                      )}
                    </div>
                    <div className="series-episode-caption">
                      <strong>
                        {episode.title ||
                          episode.name ||
                          "Título não fornecido"}
                      </strong>
                      {episode.duration && <small>{episode.duration}</small>}
                    </div>
                    {episode.description && <p>{episode.description}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
      <section className="detail-page-overview">
        <h2>Sobre {item.kind === "series" ? "a série" : "o filme"}</h2>
        <p>{item.description || "Sinopse não fornecida pela fonte."}</p>
        {item.category && (
          <div>
            <h3>Categoria</h3>
            <span>{item.category}</span>
          </div>
        )}
      </section>
    </article>
  );
}
