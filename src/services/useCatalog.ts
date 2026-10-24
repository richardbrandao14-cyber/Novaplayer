import { useEffect, useState } from "react";
import type { MediaItem } from "../domain/types";
import { demoCatalogAdapter } from "../integrations/catalog";
import { useAppStore } from "../state/useAppStore";
type CatalogState = {
  mode: boolean;
  items: readonly MediaItem[];
  status: "ready" | "error";
};
export function useCatalog() {
  const demo = useAppStore((s) => s.demo);
  const [result, setResult] = useState<CatalogState | null>(null);
  useEffect(() => {
    let active = true;
    (demo ? demoCatalogAdapter.list() : Promise.resolve([]))
      .then((items) => {
        if (active) setResult({ mode: demo, items, status: "ready" });
      })
      .catch(() => {
        if (active) setResult({ mode: demo, items: [], status: "error" });
      });
    return () => {
      active = false;
    };
  }, [demo]);
  if (!result || result.mode !== demo)
    return { items: [] as readonly MediaItem[], status: "loading" as const };
  return { items: result.items, status: result.status };
}
