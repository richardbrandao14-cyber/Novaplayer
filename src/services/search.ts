import type { MediaItem } from "../domain/types";
export function normalizeQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
export function matchesMedia(item: MediaItem, query: string) {
  return normalizeQuery(`${item.title} ${item.category}`).includes(
    normalizeQuery(query),
  );
}
export function searchMedia(
  items: readonly MediaItem[],
  query: string,
  limit = 24,
) {
  if (!normalizeQuery(query)) return [];
  const result: MediaItem[] = [];
  for (const item of items) {
    if (matchesMedia(item, query)) result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
