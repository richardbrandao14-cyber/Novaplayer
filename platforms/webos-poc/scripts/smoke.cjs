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
    // Validação por OK sem depender da validação nativa de URL do navegador.
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /Informe o servidor/);
    await page.locator("#server").fill("fixture.example");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /usuário e senha/);
    await page.locator("#username").fill("fixture-user");
    await page.locator("#password").fill("fixture-password");
    await page.evaluate(() => { window.originalOpen = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function () { throw new Error("fixture"); }; });
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    assert.match(await page.locator("#source-status").textContent(), /Não foi possível iniciar/);
    await page.evaluate(() => { XMLHttpRequest.prototype.open = window.originalOpen; delete window.originalOpen; });
    const media = fs.readFileSync(path.join(root, "media/player-av.mp4"));
    const catalog = Array.from({length:50000}, (_,i) => ({stream_id:i+1, name:"Filme sintético " + (i+1), category_id:String(i%2+1), container_extension:"mp4",direct_source:base+"/media/player-av.mp4", stream_icon:"https://fixture.example/poster.svg"}));
    const requests = [];
    await page.route(/https?:\/\/fixture\.example\//, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/poster.svg") { await route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#322316"/><circle cx="270" cy="180" r="170" fill="#ae4a10"/><path d="M0 600 400 100 400 600" fill="#16191f"/><text x="32" y="490" fill="#fff" font-size="40">NEX · TESTE</text></svg>'}); return; }
      if (url.pathname !== "/player_api.php") { await route.fulfill({contentType:"video/mp4",body:media}); return; }
      const action = url.searchParams.get("action"); requests.push(action);
      const value = !action ? {user_info:{auth:1,status:"Active"}}
        : /categories$/.test(action) ? [{category_id:1,category_name:"Categoria A"},{category_id:2,category_name:"Categoria B"}]
        : action === "get_vod_info" ? {info:{plot:"Sinopse sintética para testar a interface.",genre:"Teste",duration:"00:00:08"},movie_data:{stream_id:2,container_extension:"mp4",direct_source:base+"/media/player-av.mp4"}}
        : action === "get_series_info" ? {info:{plot:"Série sintética, sem conteúdo comercial."},episodes:{1:Array.from({length:60},(_,i)=>({id:i+1,title:"Episódio sintético "+(i+1),episode_num:i+1,container_extension:"mp4",info:{movie_image:"https://fixture.example/poster.svg"}})),2:[{id:99,title:"Outra temporada",container_extension:"mp4"}]}}
        : action === "get_series" ? [{series_id:1,name:"Série sintética",cover:"https://fixture.example/poster.svg",category_id:"1"}]
        : action === "get_live_streams" ? [{stream_id:2,name:"Canal sintético",category_id:"1",direct_source:base+"/media/player-av.mp4"}]
        : catalog;
      await route.fulfill({contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(value)});
    });
    await page.locator("#server").fill("https://fixture.example");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("50000"));
    assert.equal(await page.locator("#password").inputValue(), "");
    assert.equal(await page.locator("#catalog-list button").count(),48);
    await page.locator("#page-next").click();
    assert.match(await page.locator("#page-count").textContent(),/49–96 de 50000/);
    await page.locator("#lib-category").selectOption("2");
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("25000"));
    await page.locator("#lib-category").selectOption("");
    await page.locator("#lib-search").fill("Filme sintético 50000");
    await page.waitForFunction(() => document.querySelectorAll("#catalog-list button").length===1);
    assert.match(await page.locator("#catalog-list").textContent(),/50000/);
    await page.locator("#catalog-list button").first().click();
    await page.waitForFunction(() => document.getElementById("detail-description").textContent.includes("Sinopse sintética"));
    await page.locator("#detail-favorite").click();
    await page.locator("#detail-play").click();
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.locator("#play-pause").click();
    assert.equal(await page.locator("video").evaluate(v=>v.paused),true);
    // HUD oculta em cinco segundos e teclado o revela sem acionar botão oculto.
    await page.waitForFunction(() => document.getElementById("player").classList.contains("hud-hidden"),{},{timeout:8000});
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("hud-hidden")),false);
    // Voltar LG precisa ser consumido e preservar a página de detalhes.
    assert.equal(await page.evaluate(() => !document.dispatchEvent(new KeyboardEvent("keydown",{keyCode:461,bubbles:true,cancelable:true}))),true);
    assert.equal(await page.locator("#player").isVisible(),false);
    assert.equal(await page.locator("#details-view").isVisible(),true);
    await page.locator("#lib-back").click();
    assert.equal(await page.locator("#lib-search").inputValue(),"Filme sintético 50000");
    await page.locator("#lib-favorites").click();
    assert.equal(await page.locator("#catalog-list button").count(),1);
    await page.locator("#catalog-list button").first().click();
    await page.locator("#detail-favorite").click();
    await page.locator("#lib-back").click();
    assert.equal(await page.locator("#catalog-list button").count(),0);
    // TV: prévia lateral, segundo clique amplia, Voltar retorna à prévia e depois catálogo.
    await page.locator("#load-live").click();
    await page.getByRole("button",{name:/Canal sintético/}).waitFor();
    await page.locator("#catalog-list button").first().click();
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),true);
    assert.equal(await page.locator("#lib-search").isEnabled(),true);
    await page.locator("#player-favorite").click();
    assert.match(await page.locator("#player-favorite").textContent(), /Favoritado/);
    await page.locator("#catalog-list button").first().click();
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),false);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#player").isVisible(),false);
    await page.locator("#load-series").click();
    await page.locator("#catalog-list button").first().waitFor();
    await page.locator("#catalog-list button").first().click();
    await page.waitForFunction(() => document.querySelectorAll("#episode-list button").length===24);
    await page.locator("#episode-next").click();
    assert.match(await page.locator("#episode-list button").first().textContent(),/25/);
    await page.locator("#season-select").selectOption("2");
    assert.match(await page.locator("#episode-list").textContent(),/Outra temporada/);
    await page.locator("#season-select").selectOption("1");
    await page.locator("#episode-list button").first().click();
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.locator("#next-episode").click();
    assert.match(await page.locator("#playing-title").textContent(), /Episódio sintético 2/);
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#season-select").inputValue(),"1");
    await page.locator("#lib-back").click();
    await page.locator("#lib-home").click();
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#lib-status").evaluate(n=>n.textContent="PRÉVIA CHROMIUM · Catálogo sintético · Teste físico deste visual pendente");
    await page.waitForFunction(() => { const img=document.querySelector("#feature-art img"); return img && img.naturalWidth>0; });
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-library.png")});
    await page.setViewportSize({width:1280,height:720});
    assert.equal(await page.evaluate(()=>document.getElementById("library").scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-library-720.png")});
    await page.setViewportSize({width:1920,height:1080});
    assert.ok(requests.includes("get_vod_info") && requests.includes("get_series_info"));
    await page.locator("#lib-source").click();
    await page.locator("#clear-source").click();
    assert.equal(await page.locator("#username").inputValue(),"");
    assert.equal(await page.locator("#library").isVisible(),false);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
    assert.deepEqual(errors,[]);
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
      "PASS: MP4 H.264/AAC decoded in Chromium; pause/back/focus, 50k complete catalog/search/category/pagination, movie/series/live preview/fullscreen/back/remote HUD, no persisted credentials, 1920/1280 layout. TV/audio listening/HLS real remain manual.",
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
