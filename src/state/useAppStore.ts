import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DemoSource, PageId } from "../domain/types";
interface AppState {
  page: PageId;
  collapsed: boolean;
  demo: boolean;
  search: string;
  favorites: string[];
  historyIds: string[];
  sources: DemoSource[];
  notification: string;
  navigate: (page: PageId) => void;
  toggleSidebar: () => void;
  setDemo: (demo: boolean) => void;
  setSearch: (search: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  saveSource: (source: DemoSource) => void;
  removeSource: (id: string) => void;
  notify: (message: string) => void;
}
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      page: "home",
      collapsed: false,
      demo: true,
      search: "",
      favorites: ["aurora", "ocean", "nova-live"],
      historyIds: ["aurora", "atlas"],
      sources: [],
      notification: "",
      navigate: (page) => set({ page, search: "" }),
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
      setDemo: (demo) => set({ demo }),
      setSearch: (search) => set({ search }),
      toggleFavorite: (id) =>
        set((s) => {
          const exists = s.favorites.includes(id);
          return {
            favorites: exists
              ? s.favorites.filter((v) => v !== id)
              : [...s.favorites, id],
            notification: exists
              ? "Removido dos favoritos demonstrativos."
              : "Adicionado aos favoritos demonstrativos.",
          };
        }),
      clearHistory: () =>
        set({
          historyIds: [],
          notification: "Histórico demonstrativo limpo nesta sessão.",
        }),
      saveSource: (source) =>
        set((s) => ({
          sources: s.sources.some((v) => v.id === source.id)
            ? s.sources.map((v) => (v.id === source.id ? source : v))
            : [...s.sources, source],
        })),
      removeSource: (id) =>
        set((s) => ({
          sources: s.sources.filter((v) => v.id !== id),
          notification: "Fonte demonstrativa removida.",
        })),
      notify: (notification) => set({ notification }),
    }),
    {
      name: "nova-ui-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Somente preferências visuais: catálogo, histórico, favoritos e fontes são efêmeros.
      partialize: ({ collapsed, demo }) => ({ collapsed, demo }),
    },
  ),
);
