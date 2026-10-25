import { nativeApi } from "./native";
const cache = new Map<string, { image: string; expires: number }>();
const pending = new Map<string, Promise<string | null>>();
const budget = 12 * 1024 * 1024;
let used = 0;
export function artworkImage(mediaId: string): Promise<string | null> {
  const hit = cache.get(mediaId);
  if (hit && hit.expires > Date.now()) {
    cache.delete(mediaId);
    cache.set(mediaId, hit);
    return Promise.resolve(hit.image);
  }
  if (hit) {
    used -= hit.image.length * 2;
    cache.delete(mediaId);
  }
  const current = pending.get(mediaId);
  if (current) return current;
  const request = nativeApi
    .image(mediaId)
    .then((data) => {
      if (
        !data ||
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          data.mime,
        ) ||
        data.base64.length > 12_000_000
      )
        return null;
      const image = `data:${data.mime};base64,${data.base64}`;
      const size = image.length * 2;
      while (cache.size && (used + size > budget || cache.size >= 64)) {
        const first = cache.keys().next().value!;
        used -= cache.get(first)!.image.length * 2;
        cache.delete(first);
      }
      if (size <= budget) {
        cache.set(mediaId, { image, expires: Date.now() + 60_000 });
        used += size;
      }
      return image;
    })
    .finally(() => pending.delete(mediaId));
  pending.set(mediaId, request);
  return request;
}
