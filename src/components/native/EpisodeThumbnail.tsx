import { usePlaybackStore } from "../../state/usePlaybackStore";
import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { nativeApi } from "../../integrations/native";
let queue: Promise<unknown> = Promise.resolve();
export function EpisodeThumbnail({
  mediaId,
  episodeId,
}: {
  mediaId: string;
  episodeId: string;
}) {
  const playing = usePlaybackStore((s) => s.session !== null);
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  const [result, setResult] = useState<{
    id: string;
    image: string | null;
  } | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !element.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || playing) return;
    let active = true;
    const work = queue.then(async () => {
      if (!active || usePlaybackStore.getState().session) return;
      try {
        const data = await nativeApi.thumbnail(mediaId, episodeId);
        const image =
          data &&
          ["image/png", "image/jpeg", "image/webp"].includes(data.mime) &&
          data.base64.length < 8_000_000
            ? `data:${data.mime};base64,${data.base64}`
            : null;
        if (active) setResult({ id: episodeId, image });
      } catch {
        if (active) setResult({ id: episodeId, image: null });
      }
    });
    queue = work.catch(() => {});
    return () => {
      active = false;
    };
  }, [visible, mediaId, episodeId, playing]);
  const image = result?.id === episodeId ? result.image : null;
  return (
    <div ref={element} className="episode-thumbnail">
      {image ? (
        <img src={image} alt="Cena do episódio" loading="lazy" />
      ) : (
        <div>
          <Film size={26} />
          <span>{result ? "Prévia indisponível" : "Preparando prévia…"}</span>
        </div>
      )}
    </div>
  );
}
