import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { nativeApi } from "../../integrations/native";
type ImageResult = { mediaId: string; image: string | null; failed: boolean };
export function NativeArtwork({
  mediaId,
  hasArtwork,
  className = "",
}: {
  mediaId: string;
  hasArtwork: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
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
      { rootMargin: "100px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasArtwork, mediaId]);
  useEffect(() => {
    if (visibleId !== mediaId || !hasArtwork) return;
    let active = true;
    nativeApi
      .image(mediaId)
      .then((data) => {
        if (!active) return;
        const allowed =
          data &&
          ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            data.mime,
          ) &&
          data.base64.length <= 12_000_000;
        setResult({
          mediaId,
          image: allowed ? `data:${data.mime};base64,${data.base64}` : null,
          failed: !allowed,
        });
      })
      .catch(() => {
        if (active) setResult({ mediaId, image: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [visibleId, hasArtwork, mediaId]);
  const current = result?.mediaId === mediaId ? result : null;
  const image = current?.image;
  const failed = current?.failed ?? false;
  return (
    <div
      ref={container}
      className={`artwork native-artwork ${image && !failed ? "image-ready" : "image-pending"} ${className}`}
    >
      {image && !failed ? (
        <img
          src={image}
          alt=""
          width={500}
          height={680}
          decoding="async"
          loading="lazy"
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
