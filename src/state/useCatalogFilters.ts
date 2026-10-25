import { create } from "zustand";
export type CatalogSection = "movie" | "series";
interface Filters {
  sourceId: string;
  category: string;
  offset: number;
}
export const useCatalogFilters = create<{
  movie: Filters;
  series: Filters;
  update: (section: CatalogSection, values: Partial<Filters>) => void;
}>((set) => ({
  movie: { sourceId: "", category: "", offset: 0 },
  series: { sourceId: "", category: "", offset: 0 },
  update: (section, values) =>
    set((state) => ({ [section]: { ...state[section], ...values } })),
}));
