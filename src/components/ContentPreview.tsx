import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { Artwork } from "./Artwork";
import { NativeArtwork } from "./native/NativeArtwork";
import { useMediaNavigation } from "../state/useMediaNavigation";
import { usePlaybackStore } from "../state/usePlaybackStore";
import { keepPreview, leavePreview, useContentPreview } from "../state/useContentPreview";
import "./content-preview.css";

/** Metadata preview only; video/storyboard playback is a separate unfinished feature. */
export function ContentPreview() {
  const { content, anchor, close } = useContentPreview();
  const session = usePlaybackStore((state) => state.session);
  const open = useMediaNavigation((state) => state.open);
  useEffect(() => {
    if (!content) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [content, close]);
  if (!content || !anchor || session) return null;
  const width = Math.min(360, window.innerWidth - 32);
  const left = Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16));
  const top = Math.max(16, Math.min(anchor.top, window.innerHeight - 440));
  return createPortal(
    <section className="content-preview" aria-label={`Prévia de ${content.title}`}
      style={{ left, top, width }} onMouseEnter={keepPreview} onMouseLeave={leavePreview}
      onFocusCapture={keepPreview} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) leavePreview();
      }}>
      {content.native ? <NativeArtwork mediaId={content.native.id} hasArtwork={content.native.hasArtwork} priority />
        : content.demo ? <Artwork name={content.demo.artwork} priority /> : null}
      <button className="content-preview-close" aria-label="Fechar prévia" onClick={close}><X size={18}/></button>
      <div className="content-preview-copy">
        <h2>{content.title}</h2>
        <p>{[content.year, content.category, content.duration].filter(Boolean).join(" · ")}</p>
        {content.description && <p className="content-preview-description">{content.description}</p>}
        {content.native && <button className="content-preview-details" onClick={() => {
          if (content.native) open(content.native);
          close();
        }}><Info size={17}/>Ver detalhes</button>}
      </div>
    </section>, document.body,
  );
}
