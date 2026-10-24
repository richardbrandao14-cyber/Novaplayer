import type { CatalogPort } from "../domain/types";
export const demoCatalogAdapter: CatalogPort = {
  async list() {
    const { demoCatalog } = await import("../demo/catalog");
    return demoCatalog;
  },
};
// Não existe fallback de falha nativa para demo. O modo é escolhido explicitamente.
