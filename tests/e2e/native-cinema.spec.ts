import { test, expect } from "@playwright/test";
async function fixture(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    localStorage.setItem(
      "nova-ui-v1",
      JSON.stringify({ state: { demo: false, collapsed: false }, version: 1 }),
    );
    const names = [
      "Além da Aurora",
      "Atlas",
      "Marés",
      "Horizonte",
      "Terra",
      "Órbita",
    ];
    const art = ["hero", "atlas", "ocean", "horizon", "terra", "orbit"];
    const images = new Map<string, Promise<string>>();
    const library = new Map<
      string,
      {
        favorite: boolean;
        watchlist: boolean;
        position: number;
        duration: number;
        episodeId: string | null;
      }
    >();
    let activeMedia: string | null = null;
    let activeEpisode: string | null = null;
    const state = (id: string) =>
      library.get(id) || {
        favorite: false,
        watchlist: false,
        position: 0,
        duration: 0,
        episodeId: null,
      };
    const calls: { command: string; args: unknown }[] = [];
    Object.defineProperty(window, "novaFixtureCalls", { value: calls });
    const image = (id: string): Promise<string> => {
      const name = art[Number(id.split("-").at(-1)) % art.length] || "hero";
      if (!images.has(name))
        images.set(
          name,
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              canvas.getContext("2d")?.drawImage(img, 0, 0);
              resolve(canvas.toDataURL("image/png").split(",")[1] || "");
            };
            img.src = `/artwork/${name}.svg`;
          }),
        );
      return images.get(name)!;
    };
    const item = (kind: string, index: number) => ({
      id: `${kind}-${index}`,
      sourceId: "fixture",
      externalId: null,
      name: kind === "live" ? `Canal de teste ${index + 1}` : names[index],
      kind,
      category: "Catálogo sintético de teste",
      hasArtwork: true,
      year: "2026",
      duration: "1h 48min",
      rating: null,
      description:
        "Uma jornada para descobrir novos horizontes. Conteúdo fictício usado exclusivamente nesta prévia de interface.",
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        invoke: async (command: string, args?: Record<string, unknown>) => {
          calls.push({ command, args });
          if (command === "query_catalog") {
            const query = args?.query as {
              kind?: string;
              collection?: string;
              limit?: number;
            };
            const kind = query.kind || "movie";
            const all = Array.from(
              { length: kind === "live" ? 48 : 6 },
              (_, i) => item(kind, i),
            );
            const rows = all.filter(
              (row) =>
                !query.collection ||
                (query.collection === "favorites"
                  ? state(row.id).favorite
                  : query.collection === "watchlist"
                    ? state(row.id).watchlist
                    : state(row.id).position > 5),
            );
            return {
              items: rows.slice(0, query.limit || 60),
              total: rows.length,
              nextOffset: null,
            };
          }
          if (command === "thumbnail_for")
            return {
              mime: "image/png",
              base64: await image(
                String(args?.episodeId === "episode-1" ? "1" : "3"),
              ),
            };
          if (command === "library_state") return state(String(args?.mediaId));
          if (command === "set_library") {
            const id = String(args?.mediaId);
            library.set(id, {
              ...state(id),
              favorite: Boolean(args?.favorite),
              watchlist: Boolean(args?.watchlist),
            });
            return state(id);
          }
          if (command === "save_progress") {
            const id = String(args?.mediaId);
            library.set(id, {
              ...state(id),
              position: Number(args?.position),
              duration: Number(args?.duration),
              episodeId: args?.episodeId as string | null,
            });
            return null;
          }
          if (command === "play_media") {
            activeMedia = String(args?.mediaId);
            activeEpisode = args?.episodeId as string | null;
            return null;
          }
          if (command === "image_for")
            return {
              mime: "image/png",
              base64: await image(String(args?.mediaId)),
            };
          if (command === "list_sources")
            return [
              {
                id: "fixture",
                name: "Fonte de teste",
                kind: "xtream",
                status: "ready",
                itemCount: 24,
              },
            ];
          if (command === "list_categories")
            return ["Destaques", "Documentários", "Entretenimento"];
          if (command === "series_details")
            return [
              {
                id: "1",
                number: 1,
                episodes: [
                  {
                    id: "episode-1",
                    title: "O começo",
                    duration: "42 min",
                    description: "Episódio sintético para teste.",
                  },
                  {
                    id: "episode-2",
                    title: "Novos horizontes",
                    duration: "45 min",
                  },
                ],
              },
              {
                id: "2",
                number: 2,
                episodes: [
                  {
                    id: "episode-3",
                    title: "Além da fronteira",
                    duration: "46 min",
                  },
                ],
              },
            ];
          if (command === "player_status")
            return {
              mediaId: activeMedia,
              episodeId: activeEpisode,
              state: "playing",
              position: 32,
              duration: 180,
              volume: 80,
              paused: false,
              muted: false,
              seekable: true,
              speed: 1,
              tracks: [],
              error: null,
            };
          return null;
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Além da Aurora", exact: true }),
  ).toBeVisible();
}
test("filme abre página própria e episódio inicia com um clique, preservando temporada", async ({
  page,
}) => {
  await fixture(page);
  await expect(
    page.getByRole("heading", { name: "Uma noite de cinema" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sua próxima série" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ver detalhes de Além da Aurora",
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole("article", { name: "Detalhes de Além da Aurora" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Favoritado", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Minha Lista", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Na Minha Lista", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Assistir agora", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "Assistindo Além da Aurora" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { novaFixtureCalls: { command: string }[] }
          ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { novaFixtureCalls: { command: string }[] }
        ).novaFixtureCalls.some((c) => c.command === "save_progress"),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Space");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            novaFixtureCalls: {
              command: string;
              args: { control?: { kind: string; value: unknown } };
            }[];
          }
        ).novaFixtureCalls.some(
          (c) =>
            c.command === "player_control" &&
            c.args.control?.kind === "pause" &&
            c.args.control.value === true,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "Assistindo Além da Aurora" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar de 0:32", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continuar de 0:32", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              novaFixtureCalls: {
                command: string;
                args: { resume?: boolean };
              }[];
            }
          ).novaFixtureCalls
            .filter((c) => c.command === "play_media")
            .at(-1)?.args.resume,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByRole("button", { name: "Voltar à biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver episódios de Atlas", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Detalhes de Atlas" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByAltText("Cena do episódio").first()).toBeVisible();
  await page.getByLabel("Temporada", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Reproduzir Além da fronteira", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "Assistindo Além da fronteira" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              novaFixtureCalls: {
                command: string;
                args: { episodeId?: string };
              }[];
            }
          ).novaFixtureCalls
            .filter((c) => c.command === "play_media")
            .at(-1)?.args.episodeId,
      ),
    )
    .toBe("episode-3");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByLabel("Temporada", { exact: true })).toHaveValue("2");
  await expect(
    page.getByRole("button", {
      name: "Reproduzir Além da fronteira",
      exact: true,
    }),
  ).toBeVisible();
});
test("prévia visual com fixtures locais, sem tráfego remoto", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:"))
      remote.push(r.url());
  });
  await fixture(page);
  await page.locator(".cinema-feature .image-ready").waitFor();
  for (const row of await page.locator(".cinema-row").all()) {
    await row.scrollIntoViewIfNeeded();
    await row.locator(".image-ready").first().waitFor();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    const label = document.createElement("div");
    label.textContent = "PRÉVIA VISUAL · DADOS SINTÉTICOS DE TESTE";
    label.style.cssText =
      "position:fixed;right:20px;bottom:12px;padding:8px 12px;background:#080809e8;color:#bbb;font:10px sans-serif;z-index:100;letter-spacing:1px";
    document.body.appendChild(label);
  });
  await page.screenshot({
    path: "test-results/screens/NOVA-cinema-fixture.png",
    fullPage: true,
  });
  for (const width of [1440, 1100, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(remote).toEqual([]);
});

test("TV mantém categorias e rolagem na prévia; segundo clique amplia sem recarregar", async ({
  page,
}) => {
  await fixture(page);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("button", { name: "TV ao Vivo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "TV ao Vivo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prévia de Canal de teste 1", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "Prévia de Canal de teste 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Subcategorias" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { novaFixtureCalls: { command: string }[] }
          ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
      ),
    )
    .toBe(1);
  const channels = page.getByLabel("Lista de canais", { exact: true });
  expect(
    await channels.evaluate((el) => getComputedStyle(el).scrollbarWidth),
  ).toBe("none");
  await channels.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => channels.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await channels.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByRole("button", { name: "Destaques", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "Prévia de Canal de teste 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ampliar Canal de teste 1", exact: true })
    .click();
  await expect(
    page.getByRole("main", {
      name: "Assistindo Canal de teste 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            novaFixtureCalls: {
              command: string;
              args: { control?: { kind: string; value: unknown } };
            }[];
          }
        ).novaFixtureCalls.some(
          (c) =>
            c.command === "player_control" &&
            c.args.control?.kind === "fullscreen" &&
            c.args.control.value === true,
        ),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { novaFixtureCalls: { command: string }[] }
        ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "Prévia de Canal de teste 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prévia de Canal de teste 2", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { novaFixtureCalls: { command: string }[] }
          ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
      ),
    )
    .toBe(2);
  await nav.getByRole("button", { name: "Filmes", exact: true }).click();
  await expect(page.locator(".watch-docked")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Filmes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar ao menu principal", exact: true })
    .click();
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(
    nav.getByRole("button", { name: "Filmes", exact: true }).locator("span"),
  ).toBeHidden();
  await expect(
    nav.getByRole("button", { name: "Filmes", exact: true }).locator("svg"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu" }).click();
  await expect(
    nav.getByRole("button", { name: "Séries", exact: true }).locator("span"),
  ).toBeVisible();
});

test("página visual da série com temporadas e imagens; catálogo sem extravasar", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Ver episódios de Atlas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Atlas", exact: true }),
  ).toBeVisible();
  await page.locator(".detail-page-backdrop.image-ready").waitFor();
  await expect(page.getByAltText("Cena do episódio")).toHaveCount(2);
  await page.evaluate(() => {
    const label = document.createElement("div");
    label.textContent =
      "PRÉVIA DA INTERFACE · DADOS E IMAGENS SINTÉTICOS DE TESTE";
    label.style.cssText =
      "position:fixed;right:20px;bottom:12px;padding:8px 12px;background:#080809e8;color:#bbb;font:10px sans-serif;z-index:100;letter-spacing:1px";
    document.body.appendChild(label);
  });
  await page.screenshot({
    path: "test-results/screens/NOVA-series-fixture.png",
    fullPage: true,
  });
  for (const width of [1440, 1100, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("canal escolhido no início entra na TV em prévia e encerra ao sair", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Prévia de Canal de teste 1", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "Prévia de Canal de teste 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "TV ao Vivo", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { novaFixtureCalls: { command: string }[] }
          ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
      ),
    )
    .toBe(1);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: "Séries", exact: true })
    .click();
  await expect(page.locator(".watch-docked")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Séries", exact: true }),
  ).toBeVisible();
});

test("menu contextual de filmes e séries filtra catálogo, volta ao menu e acessa Início", async ({
  page,
}) => {
  await fixture(page);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("button", { name: "Filmes", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Voltar ao menu principal", exact: true }),
  ).toBeFocused();
  await expect(
    nav.getByRole("button", { name: "Todos os filmes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Subcategorias" }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Documentários", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Documentários", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            novaFixtureCalls: {
              command: string;
              args: {
                query?: { kind?: string; category?: string; offset?: number };
              };
            }[];
          }
        ).novaFixtureCalls.some(
          (c) =>
            c.command === "query_catalog" &&
            c.args.query?.kind === "movie" &&
            c.args.query.category === "Documentários" &&
            c.args.query.offset === 0,
        ),
      ),
    )
    .toBe(true);
  await page.locator(".browse-feature-art.image-ready").waitFor();
  await page.evaluate(() => {
    const label = document.createElement("div");
    label.id = "fixture-label";
    label.textContent = "INTERFACE ATUAL · DADOS SINTÉTICOS DE TESTE";
    label.style.cssText =
      "position:fixed;right:20px;bottom:10px;padding:8px 12px;background:#080809ed;color:#bbb;font:10px sans-serif;z-index:100;letter-spacing:1px";
    document.body.appendChild(label);
  });
  await page.screenshot({
    path: "test-results/screens/NOVA-menu-movies-fixture.png",
    fullPage: true,
  });
  await page.evaluate(() => document.getElementById("fixture-label")?.remove());
  for (const width of [1100, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await nav
    .getByRole("textbox", { name: "Filtrar categorias de Filmes" })
    .fill("entre");
  await expect(
    nav.getByRole("button", { name: "Documentários", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "Entretenimento", exact: true }),
  ).toBeVisible();
  await nav
    .getByRole("textbox", { name: "Filtrar categorias de Filmes" })
    .clear();
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await nav
    .getByRole("button", { name: "Expandir categorias de Filmes", exact: true })
    .click();
  await expect(
    nav.getByRole("button", { name: "Documentários", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav
    .getByRole("button", { name: "Voltar ao menu principal", exact: true })
    .click();
  await expect(
    nav.getByRole("button", { name: "Filmes", exact: true }),
  ).toBeFocused();
  await nav.getByRole("button", { name: "Séries", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Todas as séries", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav.getByRole("button", { name: "Destaques", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            novaFixtureCalls: {
              command: string;
              args: { query?: { kind?: string; category?: string } };
            }[];
          }
        ).novaFixtureCalls.some(
          (c) =>
            c.command === "query_catalog" &&
            c.args.query?.kind === "series" &&
            c.args.query.category === "Destaques",
        ),
      ),
    )
    .toBe(true);
  await nav
    .getByRole("button", { name: "Ir para o Início", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Uma noite de cinema", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "Filmes", exact: true }),
  ).toBeVisible();
});

test("busca global durante prévia esconde só superfície, mantém stream e abre filme", async ({
  page,
}) => {
  await fixture(page);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("button", { name: "TV ao Vivo", exact: true }).click();
  await page
    .getByRole("button", { name: "Prévia de Canal de teste 1", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { novaFixtureCalls: { command: string }[] }
          ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
      ),
    )
    .toBe(1);
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Buscar na biblioteca" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              novaFixtureCalls: {
                command: string;
                args: { rect?: { visible: boolean } };
              }[];
            }
          ).novaFixtureCalls
            .filter((c) => c.command === "player_surface")
            .at(-1)?.args.rect?.visible,
      ),
    )
    .toBe(false);
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              novaFixtureCalls: {
                command: string;
                args: { rect?: { visible: boolean } };
              }[];
            }
          ).novaFixtureCalls
            .filter((c) => c.command === "player_surface")
            .at(-1)?.args.rect?.visible,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { novaFixtureCalls: { command: string }[] }
        ).novaFixtureCalls.filter((c) => c.command === "play_media").length,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Buscar na biblioteca", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Busca global" }).fill("Aurora");
  await page
    .getByRole("button", { name: "Abrir Além da Aurora", exact: true })
    .click();
  await expect(
    page.getByRole("article", {
      name: "Detalhes de Além da Aurora",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".watch-docked")).toHaveCount(0);
});
