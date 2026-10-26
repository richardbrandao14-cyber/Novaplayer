import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { artworkImage } from "../../integrations/artworkCache";
type ImageResult = { mediaId: string; image: string | null; failed: boolean };
export function NativeArtwork({
  mediaId,
  hasArtwork,
  className = "",
  priority = false,
}: {
  mediaId: string;
  hasArtwork: boolean;
  className?: string;
  priority?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [landscapeFor, setLandscapeFor] = useState<string | null>(null);
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);
  useEffect(() => {
    const node = container.current;
    if (!node || !hasArtwork || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleId(mediaId);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasArtwork, mediaId]);
  useEffect(() => {
    if ((!priority && visibleId !== mediaId) || !hasArtwork) return;
    let active = true;
    artworkImage(mediaId)
      .then((image) => {
        if (active) setResult({ mediaId, image, failed: !image });
      })
      .catch(() => {
        if (active) setResult({ mediaId, image: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [visibleId, hasArtwork, mediaId, priority]);
  const current = result?.mediaId === mediaId ? result : null;
  const image = current?.image;
  const failed = current?.failed ?? false;
  return (
    <div
      ref={container}
      className={`artwork native-artwork ${image && !failed ? "image-ready" : "image-pending"} ${landscapeFor === mediaId ? "is-landscape" : ""} ${className}`}
    >
      {image && !failed ? (
        <img
          src={image}
          alt=""
          width={500}
          height={680}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={(event) =>
            setLandscapeFor(
              event.currentTarget.naturalWidth >
                event.currentTarget.naturalHeight * 1.2
                ? mediaId
                : null,
            )
          }
          onError={() => setResult({ mediaId, image: null, failed: true })}
        />
      ) : (
        <div
          className="image-fallback"
          role="img"
          aria-label={failed ? "Imagem indisponível" : "Imagem não fornecida"}
        >
          <ImageOff size={24} />
          <span>
            {hasArtwork && !failed ? "Carregando imagem" : "Sem imagem"}
          </span>
        </div>
      )}
    </div>
  );
}
