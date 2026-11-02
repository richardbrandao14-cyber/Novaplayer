import type { MouseEvent, FocusEvent } from "react";
import { create } from "zustand";
import type { NativeCatalogItem } from "../domain/native/types";
import type { MediaItem } from "../domain/types";
import { usePlaybackStore } from "./usePlaybackStore";
export interface PreviewContent {
  id: string; title: string; kind: "movie" | "series"; description: string | null;
  category: string | null; year: string | null; duration: string | null;
  native?: NativeCatalogItem; demo?: MediaItem;
}
interface PreviewState { content: PreviewContent | null; anchor: DOMRect | null; close: () => void; }
let opening: ReturnType<typeof setTimeout> | undefined;
let closing: ReturnType<typeof setTimeout> | undefined;
export const useContentPreview = create<PreviewState>((set) => ({
  content: null, anchor: null,
  close: () => { clearTimeout(opening); clearTimeout(closing); set({content:null,anchor:null}); },
}));
export function keepPreview() { clearTimeout(closing); }
export function leavePreview() {
  clearTimeout(opening); clearTimeout(closing);
  closing = setTimeout(() => useContentPreview.getState().close(), 180);
}
function schedule(content: PreviewContent, anchor: HTMLElement) {
  clearTimeout(closing); clearTimeout(opening);
  if (usePlaybackStore.getState().session) return;
  if (useContentPreview.getState().content?.id === content.id) return;
  const rect = anchor.getBoundingClientRect();
  opening = setTimeout(() => {
    if (anchor.isConnected && !usePlaybackStore.getState().session)
      useContentPreview.setState({content,anchor:rect});
  }, 900);
}
export function previewNative(item: NativeCatalogItem) {
  const enter = (element: HTMLElement) => {
    if (item.kind !== "movie" && item.kind !== "series") return;
    schedule({id:item.id,title:item.name || "Título não fornecido",kind:item.kind,description:item.description,category:item.category,year:item.year,duration:item.duration,native:item}, element);
  };
  return handlers(enter);
}
export function previewDemo(item: MediaItem) {
  const enter = (element: HTMLElement) => {
    if (item.kind === "live") return;
    schedule({id:item.id,title:item.title,kind:item.kind,description:item.description,category:item.category,year:item.year,duration:item.duration,demo:item},element);
  };
  return handlers(enter);
}
function handlers(enter:(element:HTMLElement)=>void) {
  return {
    onMouseEnter:(event:MouseEvent<HTMLElement>)=>enter(event.currentTarget),
    onMouseLeave:leavePreview,
    onFocus:(event:FocusEvent<HTMLElement>)=>enter(event.currentTarget),
    onBlur:leavePreview,
    onClick:()=>useContentPreview.getState().close(),
  };
}
