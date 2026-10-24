import { test, expect } from "@playwright/test";
test("navegação, detalhes, busca, preferências e ausência de tráfego remoto", async ({
  page,
}) => {
  const failures: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:1420") &&
      !r.url().startsWith("ws://127.0.0.1:1420")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Além da\s*Aurora/ }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const name of [
    "TV ao Vivo",
    "Filmes",
    "Séries",
    "Favoritos",
    "Histórico",
    "Minhas Listas",
    "Configurações",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await nav.getByRole("button", { name: "Séries", exact: true }).click();
  await page.getByRole("button", { name: "Ver detalhes de Atlas" }).click();
  await page.getByLabel("Temporada", { exact: true }).selectOption("2");
  await expect(
    page.getByText("Temporada 2 · Ilustrativo").first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver detalhes de Atlas" }),
  ).toBeFocused();
  await nav.getByRole("button", { name: "Filmes", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar na página" }).fill("oceano");
  await expect(
    page.getByRole("button", { name: /Ver detalhes de/ }),
  ).toHaveCount(1);
  await nav.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByLabel("Ativar demonstração").uncheck();
  await nav.getByRole("button", { name: "Início", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sua próxima história começa aqui" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expandir menu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sua próxima história começa aqui" }),
  ).toBeVisible();
  expect(failures).toEqual([]);
  expect(external).toEqual([]);
});
test("layout e movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Além da\s*Aurora/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Minimizar", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/nova-home.png", fullPage: true });
  await page.setViewportSize({ width: 900, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
