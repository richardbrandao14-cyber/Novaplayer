const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../app/domain.js");
const config = {
  server: "https://example.com:8080/player_api.php",
  user: "test user",
  password: "test&pass",
};
test("URLs restritas a HTTP/HTTPS sem credenciais de domínio", () => {
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://u:p@example.com",
    "broken",
  ])
    assert.throws(() => D.httpUrl(url));
  assert.equal(D.base("example.com:8080"), "http://example.com:8080");
  assert.equal(D.base(" https://example.com:443/ "), "https://example.com");
  assert.throws(() => D.base("ftp://example.com"));
  assert.equal(D.base(config.server), "https://example.com:8080");
  assert.throws(() => D.base("https://example.com/?username=test"));
});
test("Xtream codifica credenciais e preserva formato fornecido, sem inventar extensão", () => {
  const api = new URL(D.api(config, "get_series_info", "12"));
  assert.equal(api.searchParams.get("password"), config.password);
  assert.equal(api.searchParams.get("series_id"), "12");
  assert.equal(
    D.stream(config, "movie", { stream_id: 23, container_extension: "mkv" }),
    "https://example.com:8080/movie/test%20user/test%26pass/23.mkv",
  );
  assert.match(
    D.stream(config, "live", { stream_id: 1 }, "m3u8"),
    /\/1\.m3u8$/,
  );
  assert.throws(() => D.stream(config, "movie", { stream_id: 1 }));
  assert.throws(() =>
    D.stream(config, "movie", {
      stream_id: "../23",
      container_extension: "mp4",
    }),
  );
});
test("catálogo completo de 50 mil registros e temporadas ordenadas sem inventar títulos", () => {
  assert.equal(D.records(Array.from({ length: 50000 }, (_, i) => ({stream_id:i}))).length, 50000);
  assert.throws(() => D.records({ error: true }));
  assert.deepEqual(
    D.episodes({
      episodes: { 2: [{ id: "second" }], 1: [{ id: "first" }] },
    }).map((x) => x.id),
    ["first", "second"],
  );
  assert.throws(() => D.episodes({}));
});
test("erros não repetem URL, usuário, senha ou detalhes do servidor", () => {
  for (const code of [1, 2, 3, 4, 999])
    assert.ok(!D.mediaError(code).includes("http"));
  assert.throws(
    () => D.httpUrl("https://[bad/test&pass"),
    (e) => !e.message.includes("test&pass"),
  );
});
test("scripts da TV usam sintaxe ES5 e manifest não pede serviços privilegiados", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const acorn = require("acorn");
  for (const name of ["boot.js", "domain.js", "storage.js", "vault.js", "playback.js", "navigation.js", "profiles.js", "artwork.js", "tmdb.js", "library.js", "app.js"])
    acorn.parse(fs.readFileSync(path.join(__dirname, "../app", name), "utf8"), {
      ecmaVersion: 5,
    });
  const info = require("../app/appinfo.json");
  assert.equal(info.type, "web");
  assert.equal(info.disableBackHistoryAPI, true);
  assert.deepEqual(info.requiredACG, []);
});
test("interface não expõe credenciais em armazenamento aberto, HTML do provedor ou código remoto", () => {
  const fs = require("node:fs");
  const source = ["app.js", "library.js"].map(name => fs.readFileSync(
    require("node:path").join(__dirname, "../app", name), "utf8"
  )).join("\n");
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|innerHTML|console\./,
  );
  const html = fs.readFileSync(
    require("node:path").join(__dirname, "../app/index.html"),
    "utf8",
  );
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
});

test("EPG decodifica dados fornecidos e preserva ausência de horário",()=>{
 const rows=D.epg({epg_listings:[{title:Buffer.from("Jornal da fonte").toString("base64"),description:Buffer.from("Descrição real da fixture").toString("base64"),start_timestamp:"1700000000"},{title:"Título direto"}]});
 assert.equal(rows[0].title,"Jornal da fonte");assert.equal(rows[0].start,1700000000000);assert.equal(rows[1].start,0);assert.deepEqual(D.epg({}),[]);
 const url=new URL(D.api(config,"get_short_epg","12"));assert.equal(url.searchParams.get("stream_id"),"12");
});

test("cadastro aceita http:domínio, https:domínio e variações copiadas sem trocar HTTPS",()=>{
 for(const [input,expected] of [["✅ URL IPTV SMARTERS: http:example.com","http://example.com"],["http:example.com","http://example.com"],["http:example.com:8080","http://example.com:8080"],["https:example.com","https://example.com"],["http://example.com","http://example.com"],["https://example.com","https://example.com"],["HTTPS : / / example.com:8443/iptv/","https://example.com:8443/iptv"],["http//example.com","http://example.com"],["//example.com","http://example.com"],["\u200Bhttp:example.com\u200B","http://example.com"],["<https://example.com>","https://example.com"]])assert.equal(D.source(input,"user","pass").server,expected);
 for(const input of ["javascript:alert(1)","javascript:alert(\"http://example.com\")","data:text/plain,http://example.com","file:///secret","ftp://example.com","http://example.com:99999","http","https"])assert.throws(()=>D.source(input,"user","pass"));
});
test("link completo importa acesso sem vazar nem perder parâmetros adicionais",()=>{
 const parsed=D.source("https:example.com:8443/iptv/get.php?username=test%20user&password=a%2Bb%26c&type=m3u_plus&output=ts&token=fixture-token#list");
 assert.equal(parsed.server,"https://example.com:8443/iptv");assert.equal(parsed.user,"test user");assert.equal(parsed.password,"a+b&c");assert.equal(parsed.liveFormat,"ts");
 const api=new URL(D.api(parsed,"get_series_info","5"));assert.equal(api.pathname,"/iptv/player_api.php");assert.equal(api.searchParams.get("token"),"fixture-token");assert.equal(api.searchParams.get("action"),"get_series_info");assert.equal(api.searchParams.get("password"),"a+b&c");
 const polluted=new URL(D.api({...parsed,apiQuery:[["action[]","wrong"],["username[]","wrong"],["token","kept"]]},"get_live_streams"));assert.equal(polluted.searchParams.get("action[]"),null);assert.equal(polluted.searchParams.get("username[]"),null);assert.equal(polluted.searchParams.get("token"),"kept");
 const stream=new URL(D.stream(parsed,"movie",{stream_id:1,container_extension:"mp4"}));assert.equal(stream.searchParams.get("token"),"fixture-token");
 assert.equal(D.source("https://from:link@example.com/player_api.php","manual","override").user,"manual");
 assert.equal(D.source("https://example.com/live/u/p/123.ts").server,"https://example.com");assert.equal(D.source("https://example.com/live/u/p/123.ts").password,"p");
 assert.throws(()=>D.source("https://example.com/get.php?username=a&username=b"));
});
test("TV sem construtor URL usa parsing pelo DOM sem relaxar protocolo",()=>{
 const fs=require("node:fs"),vm=require("node:vm"),{JSDOM}=require("jsdom");const dom=new JSDOM("",{url:"https://fixture.invalid"});
 const context={window:{},document:dom.window.document,URL:undefined};vm.runInNewContext(fs.readFileSync(require("node:path").join(__dirname,"../app/domain.js"),"utf8"),context);
 const legacy=context.window.NexDomain;assert.equal(legacy.source("http:example.com:8080").server,"http://example.com:8080");assert.equal(legacy.source("https:example.com/panel/player_api.php?username=u&password=p").server,"https://example.com/panel");
 assert.equal(legacy.httpUrl("https://example.com/movie/u/p/1.mp4").href,"https://example.com/movie/u/p/1.mp4");for(const input of ["http://", "http://example.com:bad", "file:///secret", "http://u:p@example.com"])assert.throws(()=>legacy.httpUrl(input));dom.window.close();
});

test("catálogos em envelopes e mapas de IDs são aceitos sem mascarar erros",()=>{
 const rows=[{stream_id:1,name:"Fixture"}];for(const value of [rows,{data:rows},{streams:rows},{"1":rows[0]}])assert.deepEqual(D.records(value),rows);assert.throws(()=>D.records({user_info:{auth:0}}));assert.throws(()=>D.records({error:"denied"}));
});

test("resolução reporta dimensões reais sem chamar HD de 4K",()=>{
 assert.equal(D.resolution(3840,2160),"4K · 3840 × 2160");assert.equal(D.resolution(1920,1080),"Full HD · 1920 × 1080");assert.equal(D.resolution(1280,720),"HD · 1280 × 720");assert.match(D.resolution(0,0),/aguardando/);assert.equal(D.resolution(7680,4320),"8K · 7680 × 4320");
});

test("logos da fonte aceitam URL absoluta, relativa e protocolo herdado sem expor acesso",()=>{
 assert.equal(D.imageUrl(" https://cdn.example/logo.png ","http://example.com/proxy"),"https://cdn.example/logo.png");
 assert.equal(D.imageUrl("/logos/canal.png","https://example.com/proxy"),"https://example.com/logos/canal.png");
 assert.equal(D.imageUrl("logos/canal.png","https://example.com/proxy"),"https://example.com/proxy/logos/canal.png");
 assert.equal(D.imageUrl("//cdn.example/logo.svg","https://example.com"),"https://cdn.example/logo.svg");
 for(const url of ["javascript:alert(1)","data:image/png,anything","file:///secret","https://user:password@example.com/a.png", "//user:password@example.com/a.png", "https://cdn.example/\nsecret", ""])assert.equal(D.imageUrl(url,"https://example.com"),"");
});
