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
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
    if(start>=bytes.length||end<start){res.writeHead(416,{"Content-Range":"bytes */"+bytes.length}).end();return;}
    const headers={"Content-Type":types[path.extname(file)]||"application/octet-stream","Content-Length":end-start+1,"Accept-Ranges":"bytes"};
    if(range)headers["Content-Range"]="bytes "+start+"-"+end+"/"+bytes.length;
    res.writeHead(range?206:200,headers);res.end(bytes.subarray(start,end+1));
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
    assert.equal(await page.locator("#initialization-status").getAttribute("data-initialization"),"ready");
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
    await page.locator("#local-uhd").click();
    await page.waitForFunction(()=>document.getElementById("video").currentTime>.1,{},{timeout:30000});
    await page.waitForFunction(()=>{const v=document.getElementById("video"),q=v.getVideoPlaybackQuality();return q.totalVideoFrames>q.droppedVideoFrames&&q.totalVideoFrames>0;});
    assert.equal(await page.locator("video").evaluate(v=>v.videoWidth),3840);
    assert.equal(await page.locator("video").evaluate(v=>v.videoHeight),2160);
    assert.match(await page.locator("#video-quality").textContent(),/4K.*3840.*2160/);
    await page.keyboard.press("Escape");
    console.log("QA: startup/local playback");
    await page.waitForFunction(()=>{const img=document.querySelector("#login-cinema img");return img.complete&&img.naturalWidth>1500;});
    await page.locator("#server").focus();
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"username");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"password");
    await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.id),"username");
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
    console.log("QA: form validation");
    const media = fs.readFileSync(path.join(root, "media/player-av.mp4"));
    const catalog = Array.from({length:50000}, (_,i) => ({stream_id:i+1, name:"Filme sintético " + (i+1), category_id:String(i%2+1), container_extension:"mp4",direct_source:base+"/media/player-av.mp4", stream_icon:"https://fixture.example/poster.svg"}));
    const requests = [];let failLive=true,emptySeries=true;
    await page.route(/https?:\/\/fixture\.example\//, async (route) => {
      const url = new URL(route.request().url());
      if (/^\/logos\//.test(url.pathname)) { await route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect width="180" height="100" rx="12" fill="#f3f1ed"/><text x="90" y="56" text-anchor="middle" font-size="22" fill="#17191e">TV · TESTE</text></svg>'}); return; }
      if (url.pathname === "/poster.svg") { await route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#322316"/><circle cx="270" cy="180" r="170" fill="#ae4a10"/><path d="M0 600 400 100 400 600" fill="#16191f"/><text x="32" y="490" fill="#fff" font-size="40">NEX · TESTE</text></svg>'}); return; }
      if (url.pathname !== "/player_api.php") {
        const range=/bytes=(\d+)-(\d*)/.exec(route.request().headers().range||"");const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),media.length-1):media.length-1;
        const headers={"Accept-Ranges":"bytes"};if(range)headers["Content-Range"]="bytes "+start+"-"+end+"/"+media.length;
        await route.fulfill({status:range?206:200,contentType:"video/mp4",headers,body:media.subarray(start,end+1)}); return;
      }
      assert.equal(url.searchParams.get("token"),"fixture-token");
      const action = url.searchParams.get("action"); requests.push(action);
      if(action==="get_live_streams"&&failLive){failLive=false;await route.fulfill({status:503,body:"Unavailable"});return;}
      if(action==="get_series"&&emptySeries){emptySeries=false;await route.fulfill({contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:"[]"});return;}
      if(action==="get_live_categories"){await route.fulfill({contentType:"application/json",body:JSON.stringify([{category_id:"root",category_name:"Canais"},{category_id:"1",category_name:"Notícias",parent_id:"root"},{category_id:"2",category_name:"Outros",parent_id:"root"}])});return;}
      const value = !action ? {user_info:{auth:1,status:"Active"}}
        : action === "get_short_epg" ? {epg_listings:[{title:Buffer.from("Jornal sintético").toString("base64"),description:Buffer.from("Descrição de programação sintética").toString("base64"),start_timestamp:1700000000}]}
        : /categories$/.test(action) ? [{category_id:1,category_name:"Categoria A"},{category_id:2,category_name:"Categoria B"}]
        : action === "get_vod_info" ? {info:{plot:"Sinopse sintética para testar a interface.",genre:"Teste",duration:"00:00:08"},movie_data:{stream_id:Number(url.searchParams.get("vod_id")),container_extension:"mp4",direct_source:base+"/media/player-av.mp4"}}
        : action === "get_series_info" ? {info:{plot:"Série sintética, sem conteúdo comercial."},episodes:{1:Array.from({length:60},(_,i)=>({id:i+1,title:"Episódio sintético "+(i+1),episode_num:i+1,container_extension:"mp4",info:{movie_image:"https://fixture.example/poster.svg"}})),2:[{id:99,title:"Outra temporada",container_extension:"mp4"}],3:[],4:[],5:[],6:[],7:[],8:[]}}
        : action === "get_series" ? {"1":{series_id:1,name:"Série sintética",cover:"https://fixture.example/poster.svg",category_id:"1"}}
        : action === "get_live_streams" ? {streams:[{stream_id:2,name:"Canal sintético",stream_icon:"https://fixture.example/logos/one.svg",category_id:"1",direct_source:base+"/media/player-av.mp4"},{stream_id:3,name:"Segundo canal de teste",stream_icon:"/logos/two.svg",category_id:"1",direct_source:base+"/media/player-av.mp4"},{stream_id:4,name:"Terceiro canal de teste",stream_icon:"//fixture.example/logos/three.svg",category_id:"2",direct_source:base+"/media/player-av.mp4"}]}
        : {data:catalog};
      await route.fulfill({contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(value)});
    });
    console.log("QA: provider fixture ready");
    await page.locator("#remember-access").check();
    assert.equal(await page.locator("#vault-create").isVisible(),false);
    await page.locator("#username").fill("");
    await page.locator("#password").fill("");
    await page.locator("#server").fill("http:fixture.example/get.php?username=fixture-user&password=fixture-password&output=ts&token=fixture-token");
    await page.locator("#connect-source").focus();
    await page.locator("#connect-source").dispatchEvent("keydown", { keyCode: 13 });
    await page.locator('#profile-list button[data-profile="default"]').click();
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("50000"));
    console.log("QA: authentication/catalog");assert.equal(await page.locator(".tv-sidebar> #lib-profiles.profile-entry").count(),1);
    const searchGeometry=await page.locator("#search-open").evaluate(node=>{const r=node.getBoundingClientRect(),parent=document.querySelector(".tv-sidebar").getBoundingClientRect();return {delta:Math.abs((r.left+r.right)/2-(parent.left+parent.right)/2),width:r.width};});
    assert.ok(searchGeometry.delta<2&&searchGeometry.width>=190);
    await page.locator("#search-open").click();
    assert.equal(await page.locator("#search-panel").isVisible(),true);
    await page.locator("#lib-search").focus();assert.equal(await page.locator(".tv-search").evaluate(node=>node.classList.contains("search-focused")),true);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.locator("#catalog-list button").first().focus();
    assert.equal(await page.locator("#catalog-list button").first().evaluate(node=>getComputedStyle(node).transform),"none");
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.keyboard.press("Escape");assert.equal(await page.locator("#search-panel").isVisible(),false);
    await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));

    assert.equal(await page.locator("#password").inputValue(), "");
    assert.equal(await page.locator("#server").inputValue(),"http://fixture.example");
    assert.equal(await page.locator("#catalog-list button").count(),48);
    // A grade mantém coluna e não joga as setas para menus ou paginação.
    await page.locator("#catalog-list button").first().focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-content-id")),"7");
    await page.waitForFunction(()=>document.getElementById("library").scrollTop>0);
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#catalog-list button").nth(6).evaluate(node=>getComputedStyle(node).boxShadow),"none");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(()=>document.activeElement.id),"feature-open");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-content-id")),"1");
    for(let row=0;row<8;row++)await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-content-id")),"49");
    assert.match(await page.locator("#page-count").textContent(),/49–96 de 50000/);
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-content-id")),"43");
    await page.locator("#page-next").click();
    assert.match(await page.locator("#page-count").textContent(),/49–96 de 50000/);
    await page.locator("#lib-category option[value=\"2\"]").waitFor({state:"attached"});
    await page.locator("#load-movies").click();
    await page.locator('#sidebar-category-list button[data-category-id=""]').focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-category-id")),"1");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-category-id")),"2");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("25000"));
    await page.locator('#sidebar-category-list button[data-category-id=""]').click();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains("tv-card")),true);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-category-id")),"");
    await page.keyboard.press("Escape");assert.equal(await page.locator("#sidebar-categories").isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),"load-movies");
    await page.keyboard.press("Enter");assert.equal(await page.locator("#sidebar-categories").isVisible(),true);


    await page.locator("#catalog-list button").nth(1).focus();
    await page.waitForFunction(()=>document.getElementById("feature-title").textContent==="Filme sintético 2");
    await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.id),"feature-open");
    await page.locator("#feature-list").click();assert.match(await page.locator("#feature-list").textContent(),/Na minha lista/);
    await page.locator("#feature-favorite").click();assert.match(await page.locator("#feature-favorite").textContent(),/Favoritado/);
    await page.locator("#feature-favorite").click();
    await page.locator("#lib-watchlist").click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===1);assert.equal(await page.locator("#catalog-list button").count(),1);
    assert.equal(await page.locator("#catalog-list button").first().getAttribute("data-content-id"),"2");
    await page.locator("#lib-home").click();
    await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#search-open").click();
    await page.locator("#lib-search").fill("nenhum resultado zzz");
    await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===0);
    await page.locator("#lib-search").fill("Filme sintético 50000");
    await page.waitForFunction(() => document.querySelectorAll("#catalog-list button").length===1);
    assert.match(await page.locator("#catalog-list").textContent(),/50000/);
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("detail-description").textContent.includes("Sinopse sintética"));
    await page.locator("#detail-favorite").click();
    await page.locator("#detail-play").click();
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.locator("#play-pause").click();
    assert.equal(await page.locator("video").evaluate(v=>v.paused),true);
    await page.locator("video").evaluate(v=>{v.currentTime=6;});
    await page.waitForFunction(()=>!document.getElementById("video").seeking&&document.getElementById("video").currentTime>=5.8);
    await page.locator("video").evaluate(v=>{const track=v.addTextTrack("subtitles","Português de teste","pt");track.addCue(new VTTCue(0,8,"NEX · legenda sintética"));});
    await page.waitForFunction(()=>!document.getElementById("subtitle-track").disabled);
    // Setas ajustam a posição diretamente ao focar a barra, sem OK prévio.
    assert.deepEqual(await page.locator(".player-bottom .actions button").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.hidden).slice(0,4).map(n=>n.id)),["seek-back","play-pause","seek-forward","player-settings-open"]);
    const controlsCenter=await page.locator(".player-bottom .actions").evaluate(row=>{const visible=Array.from(row.querySelectorAll("button")).filter(n=>!n.hidden&&n.getClientRects().length),first=visible[0].getBoundingClientRect(),last=visible[visible.length-1].getBoundingClientRect();return Math.abs((first.left+last.right)/2-innerWidth/2);});assert.ok(controlsCenter<3);assert.equal(await page.locator("#play-pause").textContent(),"");assert.equal(await page.locator("#play-pause").getAttribute("aria-label"),"Reproduzir");
    await page.locator("#play-pause").focus();await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.id),"timeline");
    await page.keyboard.press("ArrowLeft");await page.waitForFunction(()=>document.getElementById("video").currentTime<.5);
    assert.equal(await page.evaluate(()=>document.activeElement.id),"timeline");await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"play-pause");
    await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.id),"seek-forward");await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.id),"player-settings-open");
    await page.locator("video").evaluate(v=>{v.currentTime=6;});await page.waitForFunction(()=>!document.getElementById("video").seeking);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-player-review.png")});
    await page.locator("#player-settings-open").click();assert.equal(await page.evaluate(()=>document.activeElement.id),"play-speed");
    await page.keyboard.press("ArrowRight");assert.equal(await page.locator("video").evaluate(v=>v.playbackRate),1.25);
    await page.keyboard.press("ArrowLeft");assert.equal(await page.locator("video").evaluate(v=>v.playbackRate),1);
    await page.locator("#subtitle-track").selectOption("0");
    assert.equal(await page.locator("video").evaluate(v=>v.textTracks[0].mode),"showing");
    await page.locator("#subtitle-track").selectOption("-1");
    assert.equal(await page.locator("video").evaluate(v=>v.textTracks[0].mode),"disabled");
    await page.waitForTimeout(250);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-player-settings-review.png")});
    await page.keyboard.press("Escape");assert.equal(await page.locator("#player-settings").isVisible(),false);
    assert.equal(await page.locator("#player").isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),"player-settings-open");
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
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Enter");
    await page.locator("#detail-favorite").click();
    await page.locator("#lib-back").click();
    assert.equal(await page.locator("#catalog-list button").count(),0);
    console.log("QA: movie/subtitles/favorites");
    // TV: prévia lateral, segundo clique amplia, Voltar retorna à prévia e depois catálogo.
    await page.locator("#load-live").click();
    await page.locator("#catalog-retry").waitFor({state:"visible"});
    assert.match(await page.locator("#lib-status").textContent(),/HTTP 503/);
    await page.locator("#catalog-retry").click();
    await page.getByRole("button",{name:/Canal sintético/}).waitFor();
    await page.waitForFunction(()=>{const logos=document.querySelectorAll("#catalog-list .channel-logo img");return logos.length===3&&Array.from(logos).every(img=>img.complete&&img.naturalWidth>0);});
    assert.deepEqual(await page.locator("#catalog-list .channel-logo img").evaluateAll(images=>images.map(img=>img.src)),["https://fixture.example/logos/one.svg","http://fixture.example/logos/two.svg","http://fixture.example/logos/three.svg"]);
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),true);
    assert.equal(await page.locator("#lib-search").isEnabled(),true);
    const inlineGeometry=await page.evaluate(()=>{const player=document.getElementById("player"),video=document.getElementById("video"),r=video.getBoundingClientRect(),top=player.querySelector(".player-top").getBoundingClientRect(),bottom=player.querySelector(".player-bottom").getBoundingClientRect();return {width:r.width,height:r.height,uncovered:bottom.top-top.bottom,center:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2).id,decoded:video.videoWidth};});
    assert.ok(inlineGeometry.width>400&&inlineGeometry.height>250&&inlineGeometry.uncovered>150);
    assert.equal(inlineGeometry.center,"video");assert.equal(inlineGeometry.decoded,1280);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-live-preview.png")});
    await page.setViewportSize({width:1280,height:720});
    await page.waitForFunction(()=>Math.abs(document.getElementById("video").getBoundingClientRect().width-document.getElementById("player").getBoundingClientRect().width)<2);
    const smallPreview=await page.evaluate(()=>{const p=document.getElementById("player"),r=p.getBoundingClientRect(),top=p.querySelector(".player-top").getBoundingClientRect(),bottom=p.querySelector(".player-bottom").getBoundingClientRect();return {clear:bottom.top-top.bottom,right:r.right,bottom:r.bottom};});
    assert.ok(smallPreview.clear>150&&smallPreview.right<=1280&&smallPreview.bottom<=720);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-live-preview-720.png")});
    await page.setViewportSize({width:1920,height:1080});


    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.id),"expand-player");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"play-pause");await page.keyboard.press("Enter");assert.equal(await page.locator("video").evaluate(v=>v.paused),true);await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"player-favorite");await page.keyboard.press("Enter");
    assert.match(await page.locator("#player-favorite").textContent(), /Favoritado/);
    await page.locator("#show-epg").click();
    await page.waitForFunction(()=>document.getElementById("epg-list").textContent.includes("Jornal sintético"));
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-epg.png")});
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#epg-panel").isVisible(),false);
    assert.equal(await page.locator("#player").isVisible(),true);
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("ArrowRight");await page.keyboard.press("Enter");
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),false);
    // HUD aberto: setas chegam ao progresso e Ajustes sem trocar canal.
    await page.waitForFunction(()=>!document.getElementById("timeline").disabled);
    await page.locator("#play-pause").focus();await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(()=>document.activeElement.id),"timeline");
    assert.equal(await page.locator("#playing-title").textContent(),"Canal sintético");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"play-pause");
    await page.locator("#player-settings-open").click();await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#playing-title").textContent(),"Canal sintético");await page.keyboard.press("Escape");
    // Sem janela seekable não é oferecido retrocesso; a navegação continua funcionando.
    await page.locator("video").evaluate(v=>{v._qaSeekable=Object.getOwnPropertyDescriptor(v,"seekable");Object.defineProperty(v,"seekable",{configurable:true,value:{length:0}});v.dispatchEvent(new Event("timeupdate"));});
    await page.locator("#play-pause").focus();await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.id),"back");
    assert.equal(await page.locator("#playing-title").textContent(),"Canal sintético");
    await page.locator("video").evaluate(v=>{delete v.seekable;if(v._qaSeekable)Object.defineProperty(v,"seekable",v._qaSeekable);delete v._qaSeekable;v.dispatchEvent(new Event("timeupdate"));});
    await page.waitForFunction(()=>document.getElementById("player").classList.contains("hud-hidden"),{},{timeout:8000});
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(()=>document.getElementById("playing-title").textContent==="Segundo canal de teste");
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),false);
    await page.keyboard.press("ChannelUp").catch(()=>page.locator("#player").dispatchEvent("keydown",{key:"ChannelUp",keyCode:427}));
    await page.waitForFunction(()=>document.getElementById("playing-title").textContent==="Canal sintético");
    await page.locator("#channel-previous").click();
    await page.waitForFunction(()=>document.getElementById("playing-title").textContent==="Terceiro canal de teste");
    await page.locator("#channel-next").click();
    await page.waitForFunction(()=>document.getElementById("playing-title").textContent==="Canal sintético");

    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#player").evaluate(n=>n.classList.contains("is-preview")),true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#player").isVisible(),false);
    await page.locator('#sidebar-category-list [data-category-id="root"]').click();assert.equal(await page.locator('#sidebar-category-list [data-category-id="root"]').count(),0);assert.equal(await page.locator('#sidebar-category-list [data-category-id="1"]').count(),1);
    await page.locator('#sidebar-category-list [data-category-id="1"]').click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===2);
    await page.locator("#sidebar-main").click();assert.equal(await page.locator('#sidebar-category-list [data-category-id="root"]').count(),1);
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Escape");assert.equal(await page.evaluate(()=>document.activeElement.id),"load-live");
    await page.locator("#lib-favorites").click();await page.locator("#favorite-tv-type").click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===1);assert.match(await page.locator("#catalog-list").textContent(),/Canal sintético/);
    await page.locator('#continue-types [data-continue-type="series"]').click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===0);
    await page.locator("#load-live").click();
    console.log("QA: live/EPG/remote preview/favorite types/category hierarchy");
    await page.locator("#sidebar-main").click();
    await page.locator("#load-series").click();
    await page.locator("#catalog-retry").waitFor({state:"visible"});
    assert.match(await page.locator("#lib-status").textContent(),/zero registros/);
    await page.locator("#catalog-retry").click();
    await page.locator("#catalog-list button").first().waitFor();
    await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll("#episode-list button").length===24);
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-season")),"1");
    for(let i=0;i<7;i++)await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-season")),"8");
    assert.equal(await page.locator('#season-options button[aria-pressed="true"]').getAttribute("data-season"),"1");
    await page.waitForFunction(()=>document.getElementById("season-options").scrollLeft>0);
    await page.keyboard.press("Enter");assert.match(await page.locator("#season-current").textContent(),/Temporada 8/);
    assert.equal(await page.locator("#episode-list button").count(),0);
    await page.locator('#season-options button[data-season="1"]').focus();await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.classList.contains("episode-card")),true);
    await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-season")),"1");
    await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.id),"detail-play");
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-season")),"1");
    await page.waitForTimeout(250);await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-seasons-review.png")});
    await page.locator("#episode-next").click();
    assert.match(await page.locator("#episode-list button").first().textContent(),/25/);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-series.png")});
    await page.locator('#season-options button[data-season="2"]').click();
    assert.match(await page.locator("#episode-list").textContent(),/Outra temporada/);
    await page.locator('#season-options button[data-season="1"]').click();
    await page.locator("#episode-list button").first().click();
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.locator("#next-episode").click();
    assert.match(await page.locator("#playing-title").textContent(), /Episódio sintético 2/);
    await page.waitForFunction(() => document.getElementById("video").currentTime>.1);
    await page.locator("#player-settings-open").click();
    await page.locator("video").evaluate(v=>{v.currentTime=7.8;});
    await page.locator("#next-prompt").waitFor({state:"visible"});
    assert.equal(await page.locator("#player-settings").isVisible(),false);
    await page.locator("#next-cancel").click();
    assert.equal(await page.locator("#next-prompt").isVisible(),false);
    await page.locator("#next-episode").click();
    await page.waitForFunction(()=>document.getElementById("video").currentTime>.1);
    await page.locator("video").evaluate(v=>{v.currentTime=7.8;});
    await page.locator("#next-prompt").waitFor({state:"visible"});
    await page.waitForFunction(()=>document.getElementById("playing-title").textContent.includes("Episódio sintético 4"),{},{timeout:15000});
    await page.waitForFunction(()=>document.getElementById("video").currentTime>.1);
    await page.locator("#play-pause").click();
    await page.locator("video").evaluate(v=>{v.currentTime=4;});
    await page.waitForFunction(()=>!document.getElementById("video").seeking);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('#season-options button[aria-pressed="true"]').getAttribute("data-season"),"1");
    await page.locator("#lib-back").click();
    console.log("QA: series/autoplay");
    await page.locator("#lib-settings").click();
    await page.locator("#auto-next").uncheck();
    await page.locator("#settings-live-format").selectOption("ts");
    await page.locator("#lib-home").click();
    await page.waitForFunction(() => document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#lib-status").evaluate(n=>n.textContent="PRÉVIA CHROMIUM · Catálogo sintético · Teste físico deste visual pendente");
    await page.waitForFunction(() => { const img=document.querySelector("#feature-art img"); return img && img.naturalWidth>0; });
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-library.png")});
    await page.setViewportSize({width:1280,height:720});
    assert.equal(await page.evaluate(()=>document.getElementById("library").scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-library-720.png")});
    await page.setViewportSize({width:1920,height:1080});
    assert.equal(requests.filter(action=>action==="get_vod_streams").length,1,"Navegar não deve duplicar catálogos grandes na memória");
    assert.ok(requests.includes("get_vod_info") && requests.includes("get_series_info"));
    console.log("QA: screenshots");
    const storedBeforeReload=await page.evaluate(()=>JSON.stringify(localStorage));
    for(const secret of ["fixture-user","fixture-password","fixture-token","http://fixture.example","unlock fixture secret"])assert.ok(!storedBeforeReload.includes(secret));
    await page.addInitScript(()=>{window.URL=undefined;});
    await page.reload();
    await page.locator('#profile-list button[data-profile="default"]').waitFor();
    assert.equal(await page.locator("#vault-login").isVisible(),false);
    const localAccess=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("nex.device-access",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error("IDB failed"));});const value=await new Promise((resolve,reject)=>{const tx=db.transaction("access"),r=tx.objectStore("access").get("current");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error("read failed"));});let exportBlocked=false;try{await crypto.subtle.exportKey("raw",value.key);}catch{exportBlocked=true;}db.close();return {extractable:value.key.extractable,exportBlocked,cipherText:new TextDecoder().decode(value.cipher),legacy:localStorage.getItem("nex.vault.v1")};});assert.equal(localAccess.extractable,false);assert.equal(localAccess.exportBlocked,true);assert.equal(localAccess.legacy,null);for(const secret of ["fixture-user","fixture-password","fixture-token"])assert.ok(!localAccess.cipherText.includes(secret));
    await page.locator('#profile-list button[data-profile="default"]').click();
    await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    console.log("QA: automatic encrypted access reload");
    await page.locator("#lib-favorites").click();
    await page.waitForFunction(()=>document.getElementById("catalog-list").textContent.includes("Canal sintético"));
    await page.locator("#lib-continue").click();
    await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===2);
    assert.equal(await page.locator('#continue-types button[data-continue-type="live"]').isVisible(),false);
    await page.locator("#lib-continue").focus();await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute("data-continue-type")),true);
    await page.keyboard.press("ArrowRight");await page.keyboard.press("Enter");await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===1);await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.classList.contains("tv-card")),true);await page.keyboard.press("ArrowUp");assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("data-continue-type")),"movie");

    await page.locator('#continue-types button[data-continue-type="movie"]').click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===1);assert.match(await page.locator("#catalog-list").textContent(),/Filme/);
    await page.locator('#continue-types button[data-continue-type="series"]').click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===1);assert.match(await page.locator("#catalog-list").textContent(),/Série/);
    await page.locator('#continue-types button[data-continue-type=""]').click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===2);

    await page.waitForFunction(()=>/conteúdos|Nenhum conteúdo/.test(document.getElementById("lib-status").textContent));
    assert.equal(await page.locator("#catalog-list button").count(),2);
    await page.getByRole("button",{name:/Filme sintético 50000/}).click();
    assert.match(await page.locator("#detail-play").textContent(),/Continuar/);
    await page.locator("#detail-play").click();
    await page.waitForFunction(()=>document.getElementById("video").currentTime>=5.5);
    await page.locator("#play-pause").click();
    await page.keyboard.press("Escape");
    await page.locator("#lib-back").click();
    // A retomada também é descoberta entrando pela seção Séries, fora de Continue.
    await page.locator("#lib-home").click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#load-series").click();await page.locator("#catalog-list button").first().focus();await page.keyboard.press("Enter");
    await page.waitForFunction(()=>document.querySelectorAll("#episode-list button").length>0);
    assert.equal(await page.locator("#series-progress").isVisible(),true);assert.match(await page.locator("#series-resume-title").textContent(),/Episódio sintético 4/);assert.match(await page.locator("#series-remaining").textContent(),/Faltam/);
    await page.locator("#detail-play").focus();await page.waitForTimeout(200);await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-series-progress.png")});
    await page.locator("#detail-play").click();assert.equal(await page.locator("#resume-choice").isVisible(),true);assert.match(await page.locator("#resume-choice-time").textContent(),/assistidos/);
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-resume-choice.png")});
    await page.keyboard.press("ArrowLeft");assert.equal(await page.evaluate(()=>document.activeElement.id),"resume-start");await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.id),"resume-continue");
    await page.keyboard.press("Escape");assert.equal(await page.locator("#resume-choice").isVisible(),false);assert.equal(await page.locator("#player").isVisible(),false);
    await page.locator("#detail-play").click();
    // TV-like startup: unknown duration/window, then two ignored seek assignments.
    await page.locator("video").evaluate(v=>{const proto=HTMLMediaElement.prototype,duration=Object.getOwnPropertyDescriptor(proto,"duration"),seekable=Object.getOwnPropertyDescriptor(proto,"seekable"),time=Object.getOwnPropertyDescriptor(proto,"currentTime");let ready=false,writes=0;Object.defineProperty(v,"duration",{configurable:true,get(){return ready?duration.get.call(v):NaN;}});Object.defineProperty(v,"seekable",{configurable:true,get(){return ready?seekable.get.call(v):{length:0};}});Object.defineProperty(v,"currentTime",{configurable:true,get(){return time.get.call(v);},set(value){writes++;if(writes>2)time.set.call(v,value);}});v._resumeTestRestore=()=>{delete v.duration;delete v.seekable;delete v.currentTime;};setTimeout(()=>{ready=true;v.dispatchEvent(new Event("durationchange"));v.dispatchEvent(new Event("progress"));},700);});
    await page.locator("#resume-continue").click();await page.waitForTimeout(1000);
    const protectedProgress=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>/^nex\.shelf\.v1\.[a-f0-9]{64}$/.test(k));return JSON.parse(localStorage.getItem(key)).progress["episode:4"].position;});assert.ok(protectedProgress>=3.8);

    await page.waitForFunction(()=>document.getElementById("video").currentTime>=3.8);
    assert.match(await page.locator("#playing-title").textContent(),/Episódio sintético 4/);
    await page.locator("video").evaluate(v=>{v._resumeTestRestore();delete v._resumeTestRestore;});
    await page.locator("#play-pause").click();await page.keyboard.press("Escape");
    await page.locator("#detail-play").click();await page.locator("#resume-start").click();
    await page.waitForFunction(()=>{const v=document.getElementById("video");return v.currentTime>.1&&v.currentTime<2;});
    await page.locator("#play-pause").click();await page.locator("video").evaluate(v=>{v.currentTime=4;});await page.waitForFunction(()=>!document.getElementById("video").seeking);await page.keyboard.press("Escape");
    await page.locator("#lib-settings").click();
    assert.equal(await page.locator("#auto-next").isChecked(),false);
    assert.equal(await page.locator("#settings-live-format").inputValue(),"ts");
    await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-settings.png")});
    await page.locator("#lib-home").focus();await page.keyboard.press("Enter");await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));assert.equal(await page.locator("#lib-home").getAttribute("aria-current"),"page");await page.locator("#back-series-list button").waitFor();assert.match(await page.locator("#back-series").textContent(),/De volta às séries/);assert.equal(await page.locator("#back-series-list button").count(),1);await page.locator("#back-series-list button").focus();await page.waitForTimeout(180);await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-home-recent.png")});await page.locator("#back-series-list button").focus();await page.keyboard.press("Enter");await page.waitForFunction(()=>document.getElementById("detail-title").textContent==="Série sintética");await page.keyboard.press("Escape");
    console.log("QA: profile isolation/home recent series");
    await page.locator("#lib-profiles").click();
    for(let i=2;i<=5;i++){await page.locator("#profile-add").click();await page.locator("#profile-name").fill("Pessoa "+i);await page.locator("#profile-submit").click();}
    assert.equal(await page.locator("#profile-list button").count(),5);assert.equal(await page.locator("#profile-form").isVisible(),false);assert.equal(await page.locator(".tv-sidebar").isVisible(),false);assert.equal(await page.locator("#profile-submit").isDisabled(),true);
    await page.keyboard.press("ArrowDown");assert.equal(await page.evaluate(()=>document.activeElement.id),"profile-manage");await page.keyboard.press("Enter");await page.locator("#profile-picture").click();assert.equal(await page.locator("#profile-avatar-options button").count(),12);await page.locator("#profile-avatar-options").scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-avatar-choices.png")});await page.locator('#profile-avatar-options [data-avatar="avatar-12"]').focus();await page.keyboard.press("Enter");await page.locator("#profile-rename").click();await page.locator("#profile-name").fill("Principal");await page.locator("#profile-submit").click();
    await page.waitForTimeout(200);assert.equal(await page.locator("#profile-list .avatar-art").evaluateAll(nodes=>new Set(nodes.map(node=>getComputedStyle(node).backgroundPosition)).size),5);await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-profiles.png")});
    await page.locator("#profile-list button").nth(1).click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#lib-favorites").click();assert.equal(await page.locator("#catalog-list button").count(),0);
    await page.locator("#lib-continue").click();assert.equal(await page.locator("#catalog-list button").count(),0);await page.locator("#lib-home").click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));assert.equal(await page.locator("#back-series").isVisible(),false);
    await page.locator("#lib-home").click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    await page.locator("#catalog-list button").nth(2).focus();await page.keyboard.press("Enter");await page.locator("#detail-favorite").click();
    await page.locator("#lib-profiles").click();await page.locator('#profile-list button[data-profile="default"]').click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    assert.equal(await page.locator("#active-profile-avatar").evaluate(node=>node.classList.contains("avatar-12")),true);assert.equal(await page.locator("#active-profile-label").textContent(),"Principal");await page.locator("#lib-favorites").click();assert.equal(await page.locator('#catalog-list button[data-content-id="3"]').count(),0);assert.equal(await page.locator('#catalog-list button[data-content-id="2"]').count(),1);
    await page.locator("#lib-continue").click();await page.waitForFunction(()=>document.querySelectorAll("#catalog-list button").length===2);await page.screenshot({path:path.resolve(__dirname,"../dist/nex-webos-continue.png")});
    await page.evaluate(async()=>{await window.NexVault.browser().save({server:"http://fixture.example",user:"fixture-user",password:"fixture-password",apiQuery:[["token","fixture-token"]]},"legacy fixture unlock");await window.NexQuickAccess().forget();});
    await page.reload();await page.locator("#vault-password").fill("wrong password");await page.locator("#vault-unlock").click();await page.waitForFunction(()=>document.getElementById("vault-status").textContent.includes("incorreta"));await page.locator("#vault-password").fill("legacy fixture unlock");await page.locator("#vault-unlock").click();await page.locator('#profile-list button[data-profile="default"]').waitFor();await page.reload();await page.locator('#profile-list button[data-profile="default"]').waitFor();assert.equal(await page.locator("#vault-login").isVisible(),false);await page.locator('#profile-list button[data-profile="default"]').click();await page.waitForFunction(()=>document.getElementById("page-count").textContent.includes("50000"));
    console.log("QA: legacy password vault migrated to automatic access");
    await page.locator("#lib-source").click();
    await page.locator("#clear-source").click();
    assert.equal(await page.locator("#username").inputValue(),"");
    assert.equal(await page.locator("#library").isVisible(),false);
    assert.ok(await page.evaluate(()=>localStorage.length>=2));
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
      "PASS: MP4 H.264/AAC HD and 3840x2160 4K decoded in Chromium; pause/back/focus, 50k complete catalog/search/category/pagination, movie/series/live preview/fullscreen/back/remote HUD, encrypted access reload, durable favorites/resume, EPG, captions and next-episode countdown, 1920/1280 layout. TV/audio listening/HLS real remain manual.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error.stack);
  server.close();
  process.exitCode = 1;
});
