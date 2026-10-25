import { create } from "zustand";
import type { NativeCatalogItem, NativeSeriesDetails } from "../domain/native/types";
export interface PlaybackSession {
  item: NativeCatalogItem;
  episodeId?: string;
  episodeTitle?: string;
  seasons?: NativeSeriesDetails;
}
export const usePlaybackStore = create<{
  session: PlaybackSession | null;
  start: (session: PlaybackSession) => void;
  close: () => void;
}>((set) => ({ session: null, start: (session) => set({ session }), close: () => set({ session: null }) }));
