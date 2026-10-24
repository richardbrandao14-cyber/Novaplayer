import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { MediaItem } from "../domain/types";
import { virtualWindow } from "../services/virtualWindow";
import { useAppStore } from "../state/useAppStore";
import { Artwork } from "./Artwork";
const rowHeight = 76,
  viewportHeight = 456;
export function ChannelList({
  items,
  selected,
  onSelect,
}: {
  items: readonly MediaItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [top, setTop] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const favorites = useAppStore((s) => s.favorites);
  const toggle = useAppStore((s) => s.toggleFavorite);
  const range = virtualWindow(items.length, top, viewportHeight, rowHeight);
  return (
    <div
      ref={viewport}
      className="channel-list virtual-channels"
      role="region"
      aria-label="Canais demonstrativos"
      tabIndex={0}
      style={{ height: viewportHeight }}
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        viewport.current?.focus();
        const index = items.findIndex((i) => i.id === selected);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    index + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                );
        const item = items[next];
        if (item) {
          onSelect(item.id);
          const element = viewport.current;
          if (element) {
            const nextTop = next * rowHeight;
            if (nextTop < element.scrollTop) element.scrollTop = nextTop;
            else if (
              nextTop + rowHeight >
              element.scrollTop + (element.clientHeight || viewportHeight)
            )
              element.scrollTop =
                nextTop + rowHeight - (element.clientHeight || viewportHeight);
          }
        }
      }}
    >
      <div
        role="list"
        aria-label={`${items.length} canais`}
        style={{ height: range.totalHeight, position: "relative" }}
      >
        {items.slice(range.start, range.end).map((item, n) => (
          <div
            key={item.id}
            role="listitem"
            aria-posinset={range.start + n + 1}
            aria-setsize={items.length}
            className={`channel-row ${selected === item.id ? "selected" : ""}`}
            style={{
              position: "absolute",
              top: (range.start + n) * rowHeight,
              height: rowHeight,
              width: "100%",
            }}
          >
            <button
              className="channel-select"
              aria-pressed={selected === item.id}
              onClick={() => onSelect(item.id)}
            >
              <Artwork name={item.artwork} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.category} · Demo</small>
              </span>
            </button>
            <button
              className="channel-heart icon-button"
              aria-label={`Favoritar canal ${item.title}`}
              aria-pressed={favorites.includes(item.id)}
              onClick={() => toggle(item.id)}
            >
              <Heart
                size={15}
                fill={favorites.includes(item.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="inline-empty">Nenhum canal encontrado.</p>
      )}
    </div>
  );
}
