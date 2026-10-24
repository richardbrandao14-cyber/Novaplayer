import { test, expect } from "@playwright/test";
async function start(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Além da\s*Aurora/ }),
  ).toBeVisible();
}
test("busca global com teclado, tooltip e menu de mídia", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Busca global").fill("atlas");
  await expect(
    page.getByRole("button", { name: /Abrir Atlas em Séries/ }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Séries", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ver detalhes de/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Mais opções: Atlas" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Favoritar demonstração" }).click();
  await expect(
    page.getByRole("button", { name: "Remover dos favoritos: Atlas" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Recolher menu" }).click();
  const home = page
    .getByRole("navigation")
    .getByRole("button", { name: "Início", exact: true });
  await home.focus();
  await expect(
    page.getByRole("tooltip", { name: "Início", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "TV ao Vivo", exact: true }),
  ).toBeFocused();
});
test("fontes demo: cadastrar, editar, remover; nenhum segredo retido ou transmitido", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!new URL(r.url()).hostname.includes("127.0.0.1"))
      external.push(r.url());
  });
  await start(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Minhas Listas" })
    .click();
  await page
    .getByRole("button", { name: "Adicionar lista", exact: true })
    .click();
  await page.getByRole("radio", { name: "Xtream" }).check();
  await page.getByLabel("Nome da lista").fill("Fonte de exemplo");
  await page
    .getByLabel("URL do servidor")
    .fill("https://example.com/path?token=sensitive-fixture");
  await page.getByLabel("Usuário", { exact: true }).fill("demo-user");
  await page.getByLabel("Senha", { exact: true }).fill("demo-secret");
  await page
    .getByRole("button", { name: "Validar campos de demonstração" })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Fechar diálogo" }).click();
  await expect(
    page.getByRole("heading", { name: "Fonte de exemplo", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "sensitive-fixture",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "demo-secret",
  );
  await page.getByRole("button", { name: "Editar Fonte de exemplo" }).click();
  await expect(page.getByLabel("URL do servidor")).toHaveValue(
    "https://example.com",
  );
  await page.getByLabel("Nome da lista").fill("Fonte editada");
  await page.getByLabel("Usuário", { exact: true }).fill("demo");
  await page.getByLabel("Senha", { exact: true }).fill("demo");
  await page
    .getByRole("button", { name: "Validar campos de demonstração" })
    .click();
  await page.getByRole("button", { name: "Fechar diálogo" }).click();
  await page.getByRole("button", { name: "Remover Fonte editada" }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fonte editada", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover Fonte editada" }).click();
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(
    page.getByRole("heading", { name: "Uma biblioteca com a sua identidade" }),
  ).toBeVisible();
  expect(external).toEqual([]);
});
test("ordenação, categorias, episódio, histórico e seleção de canais", async ({
  page,
}) => {
  await start(page);
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Filmes", exact: true }).click();
  await page.getByLabel("Ordenar por").selectOption("title");
  await expect(
    page.getByRole("button", { name: /Ver detalhes de/ }).first(),
  ).toHaveAccessibleName("Ver detalhes de Além da Aurora");
  await page
    .getByRole("button", { name: "Ficção científica", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Ver detalhes de/ }),
  ).toHaveCount(2);
  await nav.getByRole("button", { name: "TV ao Vivo", exact: true }).click();
  await page
    .getByRole("button", { name: "NOVA Cinema Cinema · Demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "NOVA Cinema", exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Histórico", exact: true }).click();
  await page.getByRole("button", { name: "Limpar histórico" }).click();
  await page.getByRole("button", { name: "Confirmar limpeza" }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma atividade por aqui" }),
  ).toBeVisible();
});
test("capturas e layout das oito telas em diferentes dimensões", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  for (const name of [
    "Início",
    "TV ao Vivo",
    "Filmes",
    "Séries",
    "Favoritos",
    "Histórico",
    "Minhas Listas",
    "Configurações",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    if (name !== "Início")
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      images.forEach((img) => {
        img.loading = "eager";
      });
      await Promise.all(images.map((img) => img.decode().catch(() => {})));
    });
    await page.screenshot({
      path: `test-results/screens/${name}.png`,
      fullPage: true,
    });
    for (const width of [1440, 1100, 900, 650, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} em ${width}px`,
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Séries", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver detalhes de Atlas" }).click();
  await page.screenshot({
    path: "test-results/screens/Detalhes.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByLabel("Busca global").fill("a");
  await page.screenshot({
    path: "test-results/screens/Busca.png",
    fullPage: true,
  });
});
