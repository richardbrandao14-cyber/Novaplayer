import { test, expect } from "@playwright/test";
async function fixture(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    localStorage.setItem("nova-ui-v1", JSON.stringify({ state: { demo: false, collapsed: false }, version: 1 }));
    const names = ["Além da Aurora", "Atlas", "Marés", "Horizonte", "Terra", "Órbita"];
    const art = ["hero", "atlas", "ocean", "horizon", "terra", "orbit"];
    const images = new Map<string, Promise<string>>();
    const calls: { command: string; args: unknown }[] = [];
    Object.defineProperty(window, "novaFixtureCalls", { value: calls });
    const image = (id: string): Promise<string> => {
      const name = art[Number(id.split("-").at(-1)) % art.length] || "hero";
      if (!images.has(name)) images.set(name, new Promise((resolve) => {
        const img = new Image(); img.onload = () => {
          const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png").split(",")[1] || "");
        }; img.src = `/artwork/${name}.svg`;
      }));
      return images.get(name)!;
    };
    const item = (kind: string, index: number) => ({ id: `${kind}-${index}`, sourceId: "fixture", externalId: null, name: kind === "live" ? `Canal de teste ${index + 1}` : names[index], kind, category: "Catálogo sintético de teste", hasArtwork: true, year: "2026", duration: "1h 48min", rating: null, description: "Uma jornada para descobrir novos horizontes. Conteúdo fictício usado exclusivamente nesta prévia de interface." });
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args });
      if (command === "query_catalog") { const query = args?.query as { kind?: string }; return { items: Array.from({ length: 6 }, (_, i) => item(query.kind || "movie", i)), total: 6, nextOffset: null }; }
      if (command === "image_for") return { mime: "image/png", base64: await image(String(args?.mediaId)) };
      if (command === "list_sources") return [{ id: "fixture", name: "Fonte de teste", kind: "xtream", status: "ready", itemCount: 24 }];
      if (command === "list_categories") return [];
      if (command === "series_details") return [{ id: "1", number: 1, episodes: [{ id: "episode-1", title: "O começo", duration: "42 min", description: "Episódio sintético para teste." }, { id: "episode-2", title: "Novos horizontes", duration: "45 min" }] }, { id: "2", number: 2, episodes: [{ id: "episode-3", title: "Além da fronteira", duration: "46 min" }] }];
      if (command === "player_status") return { state: "playing", position: 32, duration: 180, volume: 80, paused: false, muted: false, seekable: true, speed: 1, tracks: [], error: null };
      return null;
    } } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Além da Aurora", exact: true })).toBeVisible();
}
test("biblioteca cinematográfica e acesso a filme e episódio com um clique", async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole("heading", { name: "Uma noite de cinema" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sua próxima série" })).toBeVisible();
  await page.getByRole("button", { name: "Reproduzir Além da Aurora", exact: true }).first().click();
  await expect(page.getByRole("main", { name: "Assistindo Além da Aurora" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { novaFixtureCalls: { command: string }[] }).novaFixtureCalls.filter((c) => c.command === "play_media").length)).toBe(1);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByRole("main", { name: "Assistindo Além da Aurora" })).not.toBeVisible();
  await page.getByRole("button", { name: "Ver episódios de Atlas", exact: true }).click();
  await page.getByLabel("Temporada", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Reproduzir Além da fronteira", exact: true }).click();
  await expect(page.getByRole("main", { name: "Assistindo Além da fronteira" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { novaFixtureCalls: { command: string; args: { episodeId?: string } }[] }).novaFixtureCalls.filter((c) => c.command === "play_media").at(-1)?.args.episodeId)).toBe("episode-3");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByLabel("Temporada", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Reproduzir Além da fronteira", exact: true })).toBeVisible();
});
test("prévia visual com fixtures locais, sem tráfego remoto", async ({ page }) => {
  const remote: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:")) remote.push(r.url()); });
  await fixture(page);
  await page.locator(".cinema-feature .image-ready").waitFor();
  for (const row of await page.locator(".cinema-row").all()) {
    await row.scrollIntoViewIfNeeded();
    await row.locator(".image-ready").first().waitFor();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    const label = document.createElement("div"); label.textContent = "PRÉVIA VISUAL · DADOS SINTÉTICOS DE TESTE"; label.style.cssText = "position:fixed;right:20px;bottom:12px;padding:8px 12px;background:#080809e8;color:#bbb;font:10px sans-serif;z-index:100;letter-spacing:1px"; document.body.appendChild(label);
  });
  await page.screenshot({ path: "test-results/screens/NOVA-cinema-fixture.png", fullPage: true });
  for (const width of [1440, 1100, 900]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  expect(remote).toEqual([]);
});
