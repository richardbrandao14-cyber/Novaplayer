import { useState } from "react";
import type { MediaItem } from "../domain/types";
import { MediaCard } from "./MediaCard";
import { MediaDetails } from "./MediaDetails";
export function CatalogView({ items }: { items: readonly MediaItem[] }) {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  return (
    <>
      <div className="media-grid">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} onSelect={setSelected} />
        ))}
      </div>
      <MediaDetails item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
