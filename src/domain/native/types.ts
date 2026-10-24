export type CatalogKind = "live" | "movie" | "series" | "unknown";
export interface NativeSource {
  id: string;
  name: string;
  kind: string;
  status: string;
  itemCount: number;
}
export interface NativeSourceInput {
  name: string;
  kind: "m3u" | "xtream";
  url: string;
  username?: string;
  password?: string;
}
export interface NativeCatalogItem {
  id: string;
  sourceId: string;
  externalId: string | null;
  name: string | null;
  kind: CatalogKind;
  category: string | null;
  hasArtwork: boolean;
  description: string | null;
  year: string | null;
  duration: string | null;
  rating: string | null;
}
export interface NativeCatalogPage {
  items: NativeCatalogItem[];
  total: number;
  nextOffset: number | null;
}
export interface NativeCatalogQuery {
  sourceId?: string;
  kind?: CatalogKind;
  category?: string;
  search?: string;
  offset: number;
  limit: number;
  sort?: string;
}
export interface NativeJob {
  id: string;
  sourceId: string;
  state: string;
  processed: number;
  invalid: number;
  total?: number | null;
  added?: number | null;
  removed?: number | null;
  error?: { code: string; message: string } | null;
  report?: {
    valid: number;
    invalid: number;
    warnings: string[];
    added: number;
    removed: number;
  } | null;
}
export interface NativeEpisode {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  duration?: string | null;
  hasArtwork?: boolean;
}
export interface NativeSeason {
  id?: string;
  number: number;
  episodes: NativeEpisode[];
}
export type NativeSeriesDetails = NativeSeason[];
