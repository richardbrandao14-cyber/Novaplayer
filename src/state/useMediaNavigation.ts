import { create } from "zustand";
import type { NativeCatalogItem } from "../domain/native/types";
export const useMediaNavigation = create<{
  selected: NativeCatalogItem | null;
  open: (item: NativeCatalogItem) => void;
  close: () => void;
}>((set) => ({
  selected: null,
  open: (selected) => set({ selected }),
  close: () => set({ selected: null }),
}));
export const useLibraryRevision = create<{
  revision: number;
  bump: () => void;
}>((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));
