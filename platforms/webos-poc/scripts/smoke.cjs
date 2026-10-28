// Browser verification only. This does not certify decoding/audio on an LG TV.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright"); // QA dependency from repository root.
const root = path.resolve(__dirname, "../dist/app");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, bytes) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Content-Length": bytes.length,
    });
    res.end(bytes);
  });
});
async function main() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.NOVA_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + server.address().port;
    // Regressão: nenhum CSS/JS externo pode ser necessário para iniciar na TV.
    await page.route(/\.(css|js)(\?|$)/, (route) => route.abort());
    await page.goto(base);
    assert.equal(
      await page.evaluate(() => window.nexReady === true),
      true,
      "Pacote precisa iniciar sem carregar JS/CSS externos",
    );
    assert.match(
      await page.locator("#initialization-status").textContent(),
      /JavaScript OK.*Estilo OK/,
    );
    await page.locator("#toggle-tools").focus();
    await page.locator("#toggle-tools").dispatchEvent("keydown", { keyCode: 13 });
    assert.equal(await page.locator("#test-tools").isVisible(), true);
    await page
      .getByRole("button", { name: "Testar vídeo e som", exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "local-hls",
    );
    await page.locator("#local-test").focus();
    // Simular OK que entrega somente keydown, sem clique automático do navegador.
    await page.locator("#local-test").dispatchEvent("keydown", { keyCode: 13 });
    await page.waitForFunction(
      () => document.getElementById("video").currentTime > 0.1,
    );
    assert.equal(
      await page.locator("video").evaluate((v) => v.videoWidth),
      1280,
    );
    assert.equal(
      await page.getByRole("button", { name: "Imagem e som OK" }).isEnabled(),
      false,
    );
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    assert.equal(await page.locator("video").evaluate((v) => v.paused), true);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "local-test",
    );
    // Formulário deve responder ao OK mesmo com URL inválida (sem validação nativa invisível).
    await page.locator("#server").fill("servidor-sem-protocolo");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /começando com http/);
    await page.locator("#server").fill("https://fixture.example");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /usuário e senha/);
    // Abertura síncrona de XHR pode ser recusada pelo runtime; deve produzir erro visível.
    await page.locator("#username").fill("fixture-user");
    await page.locator("#password").fill("fixture-password");
    await page.evaluate(() => {
      window.originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function () { throw new Error("fixture"); };
    });
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /Não foi possível iniciar/);
    await page.evaluate(() => { XMLHttpRequest.prototype.open = window.originalOpen; delete window.originalOpen; });
    const media = fs.readFileSync(path.join(root, "media/player-av.mp4"));
    await page.route("https://fixture.example/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== "/player_api.php") {
        await route.fulfill({ contentType: "video/mp4", body: media });
        return;
      }
      const action = url.searchParams.get("action");
      const value = !action
        ? { user_info: { auth: 1, status: "Active" } }
        : action === "get_series_info"
          ? {
              episodes: {
                1: [
                  {
                    id: 3,
                    title: "Episódio sintético",
                    container_extension: "mp4",
                  },
                ],
              },
            }
          : action === "get_series"
            ? [{ series_id: 1, name: "Série sintética" }]
            : [
                {
                  stream_id: 2,
                  name:
                    action === "get_live_streams"
                      ? "Canal sintético"
                      : "Filme sintético",
                  container_extension: "mp4",
                  direct_source: base + "/media/player-av.mp4",
                },
              ];
      await route.fulfill({
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(value),
      });
    });
    await page
      .getByLabel("Servidor", { exact: true })
      .fill("https://fixture.example");
    await page.getByLabel("Usuário", { exact: true }).fill("fixture-user");
    await page.getByLabel("Senha", { exact: true }).fill("fixture-password");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    await page.waitForFunction(
      () => !document.getElementById("load-live").disabled,
    );
    assert.equal(
      await page.getByLabel("Senha", { exact: true }).inputValue(),
      "",
    );
    for (const kind of ["live", "movies", "series"]) {
      await page.locator("#load-" + kind).click();
      await page.locator("#catalog-list button").first().waitFor();
      await page.locator("#catalog-list button").first().click();
      if (kind === "series")
        await page
          .getByRole("button", { name: "Episódio sintético", exact: true })
          .click();
      await page.waitForFunction(
        () =>
          !document.getElementById("player").hidden &&
          document.getElementById("video").currentTime > 0.05,
      );
      await page
        .getByRole("button", { name: "Imagem e som OK", exact: true })
        .click();
    }
    assert.equal(
      await page.locator("#checks").textContent(),
      "TV: OK · Filme: OK · Episódio: OK",
    );
    await page
      .getByRole("button", { name: "Limpar", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Usuário", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.deepEqual(errors, []);
    await page.reload();
    assert.equal(await page.locator("#test-tools").isVisible(), false);
    await page.locator("#environment").evaluate((node) => {
      node.textContent = "PRÉVIA CHROMIUM · Ainda não testado na TV";
    });
    await page.screenshot({
      path: path.resolve(__dirname, "../dist/nex-webos-browser.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    console.log(
      "PASS: MP4 H.264/AAC decoded in Chromium; pause/back/focus, 3 fixture source flows, no persisted credentials, 1920/1280 layout. TV/audio listening/HLS real remain manual.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error.message);
  server.close();
  process.exitCode = 1;
});
