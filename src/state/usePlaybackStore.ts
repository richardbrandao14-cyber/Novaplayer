import { create } from "zustand";
import type {
  NativeCatalogItem,
  NativeSeriesDetails,
} from "../domain/native/types";
export interface PlaybackSession {
  item: NativeCatalogItem;
  episodeId?: string;
  episodeTitle?: string;
  seasons?: NativeSeriesDetails;
  mode?: "docked" | "theater";
  resume?: boolean;
  fullscreen?: boolean;
}
export const usePlaybackStore = create<{
  session: PlaybackSession | null;
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  start: (session: PlaybackSession) => void;
  close: () => void;
  setMode: (mode: "docked" | "theater", fullscreen?: boolean) => void;
}>((set) => ({
  session: null,
  overlayOpen: false,
  setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
  start: (session) => set({ session }),
  close: () => set({ session: null, overlayOpen: false }),
  setMode: (mode, fullscreen = false) =>
    set((s) => ({
      session: s.session ? { ...s.session, mode, fullscreen } : null,
    })),
}));
