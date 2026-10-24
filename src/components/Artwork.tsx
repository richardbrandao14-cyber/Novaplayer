import { useState } from "react";
import { ImageOff } from "lucide-react";
export function Artwork({
  name,
  className = "",
  priority = false,
}: {
  name: string;
  className?: string;
  priority?: boolean;
}) {
  const [failedName, setFailedName] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  return (
    <div
      className={`artwork ${loadedName === name ? "image-ready" : "image-pending"} ${className}`}
    >
      {failedName === name ? (
        <div
          className="image-fallback"
          role="img"
          aria-label="Imagem indisponível"
        >
          <ImageOff size={24} />
          <span>Sem imagem</span>
        </div>
      ) : (
        <img
          src={`/artwork/${name}.svg`}
          alt=""
          width={500}
          height={680}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoadedName(name)}
          onError={() => setFailedName(name)}
        />
      )}
    </div>
  );
}
