import { Heart, MoreHorizontal, Info } from "lucide-react";
import { DropdownMenu, ContextMenu } from "radix-ui";
import type { MediaItem } from "../domain/types";
import { Artwork } from "./Artwork";
import { useAppStore } from "../state/useAppStore";
export function MediaCard({
  item,
  onSelect,
}: {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}) {
  const favorite = useAppStore((s) => s.favorites.includes(item.id));
  const toggle = useAppStore((s) => s.toggleFavorite);
  const actions = (
    <>
      <DropdownMenu.Item className="menu-item" onSelect={() => onSelect(item)}>
        <Info size={15} />
        Ver detalhes
      </DropdownMenu.Item>
      <DropdownMenu.Item className="menu-item" onSelect={() => toggle(item.id)}>
        <Heart size={15} />
        {favorite ? "Remover dos favoritos" : "Favoritar demonstração"}
      </DropdownMenu.Item>
    </>
  );
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <article className="media-card">
          <button
            className="card-open"
            onClick={() => onSelect(item)}
            aria-label={`Ver detalhes de ${item.title}`}
          >
            <Artwork name={item.artwork} />
            <span className="poster-overlay">
              <span>EXPLORAR</span>
              <Info size={18} />
            </span>
            <span className="card-caption">
              <strong>{item.title}</strong>
              <span>
                {item.year} · {item.category}
              </span>
            </span>
          </button>
          <button
            className={`favorite-button ${favorite ? "selected" : ""}`}
            aria-label={`${favorite ? "Remover dos" : "Adicionar aos"} favoritos: ${item.title}`}
            aria-pressed={favorite}
            onClick={() => toggle(item.id)}
          >
            <Heart size={16} fill={favorite ? "currentColor" : "none"} />
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="card-more icon-button"
              aria-label={`Mais opções: ${item.title}`}
            >
              <MoreHorizontal size={18} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={6} className="context-menu">
                {actions}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {item.progress !== undefined && (
            <div
              className="progress-track"
              aria-label={`${item.progress}% demonstrativos assistidos`}
            >
              <span style={{ width: `${item.progress}%` }} />
            </div>
          )}
        </article>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu">
          <ContextMenu.Item
            className="menu-item"
            onSelect={() => onSelect(item)}
          >
            Ver detalhes
          </ContextMenu.Item>
          <ContextMenu.Item
            className="menu-item"
            onSelect={() => toggle(item.id)}
          >
            {favorite ? "Remover dos favoritos" : "Favoritar demonstração"}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
