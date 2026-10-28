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
test("catálogo limitado e temporadas ordenadas sem inventar títulos", () => {
  assert.equal(D.records(Array.from({ length: 60 }, (_, i) => i)).length, 40);
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
  for (const name of ["boot.js", "domain.js", "app.js"])
    acorn.parse(fs.readFileSync(path.join(__dirname, "../app", name), "utf8"), {
      ecmaVersion: 5,
    });
  const info = require("../app/appinfo.json");
  assert.equal(info.type, "web");
  assert.deepEqual(info.requiredACG, []);
});
test("app não grava credenciais, não usa HTML do provedor nem código remoto", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(
    require("node:path").join(__dirname, "../app/app.js"),
    "utf8",
  );
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
