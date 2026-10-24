export const destinations = [
  "home",
  "live",
  "movies",
  "series",
  "favorites",
  "history",
  "sources",
  "settings",
] as const;
export type PageId = (typeof destinations)[number];
export type MediaKind = "movie" | "series" | "live";
export interface Episode {
  id: string;
  title: string;
  description: string;
  artwork: string;
  duration: string;
  progress?: number;
}
export interface Season {
  id: string;
  number: number;
  episodes: readonly Episode[];
}
export interface DemoSource {
  id: string;
  name: string;
  kind: SourceDraft["kind"];
  host: string;
}
export interface MediaItem {
  id: string;
  title: string;
  category: string;
  kind: MediaKind;
  year: string;
  duration: string;
  description: string;
  artwork: string;
  progress?: number;
  rating?: string;
  seasons?: readonly Season[];
}
export interface SourceDraft {
  name: string;
  kind: "m3u" | "xtream";
  url: string;
  username: string;
  password: string;
}
export interface CatalogPort {
  list(): Promise<readonly MediaItem[]>;
}
export interface PlayerPort {
  open(mediaId: string): Promise<void>;
}
export interface SourcePort {
  validate(draft: SourceDraft): Record<string, string>;
}
