const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const tv=process.argv.includes("--tv");
const dist = path.join(root, "dist");
const app = path.join(dist, tv?"tv-app":"app");
fs.rmSync(tv?app:dist, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(root, "app"), app, { recursive: true });
fs.copyFileSync(path.join(repo, "LICENSE"), path.join(app, "LICENSE"));
// Recursos locais embutidos: o runtime da TV não precisa resolvê-los pela origem file:.
const inlineFiles = ["boot.js", "domain.js", "storage.js", "vault.js", "quick-access.js", "playback.js", "tmdb.js", "navigation.js", "profiles.js", "artwork.js", "home.js", "library.js", "resume.js", "icons.js", "app.js"];
const css = fs
  .readFileSync(path.join(app, "style.css"), "utf8")
  .replace(/\r\n?/g, "\n");
let html = fs.readFileSync(path.join(app, "index.html"), "utf8");
if(tv)html=html.replace('<div class="test-local panel">','<div class="test-local panel" hidden>').replace('<div class="tools-heading">','<div class="tools-heading" hidden>');
const hashes = [];
for (const name of inlineFiles) {
  const code = fs
    .readFileSync(path.join(app, name), "utf8")
    .replace(/\r\n?/g, "\n");
  if (/<\/script/i.test(code))
    throw new Error("Código não pode fechar a tag script.");
  hashes.push(
    "'sha256-" +
      crypto.createHash("sha256").update(code).digest("base64") +
      "'",
  );
  html = html.replace(
    '<script src="' + name + '"></script>',
    "<script>" + code + "</script>",
  );
}
const styleHash =
  "'sha256-" + crypto.createHash("sha256").update(css).digest("base64") + "'";
const policy =
  "default-src 'none'; script-src " +
  hashes.join(" ") +
  "; style-src " +
  styleHash +
  "; img-src 'self' file: data: http: https:; media-src 'self' file: http: https:; connect-src http: https:; object-src 'none'; base-uri 'none'; form-action 'none'";
html = html.replace(/content="default-src [^"]+"/, 'content="' + policy + '"');
html = html.replace(
  '<link rel="stylesheet" href="style.css">',
  "<style>" + css + "</style>",
);
fs.writeFileSync(path.join(app, "index.html"), html);
for (const name of [...inlineFiles, "style.css"])
  fs.unlinkSync(path.join(app, name));

if(!tv){
fs.mkdirSync(path.join(app, "media/hls"), { recursive: true });
fs.copyFileSync(
  path.join(root, "fixtures/tv-av.mp4"),
  path.join(app, "media/player-av.mp4"),
);
fs.copyFileSync(path.join(root,"fixtures/tv-uhd.mp4"),path.join(app,"media/player-uhd.mp4"));
fs.cpSync(path.join(root, "fixtures/hls"), path.join(app, "media/hls"), {
  recursive: true,
});
}
if(tv)for(const file of fs.readdirSync(dist))if(file.endsWith(".ipk"))fs.unlinkSync(path.join(dist,file));
// APPDATA é suportado pela CLI; estado isolado só neste processo filho.
const cliState = path.join(root, "node_modules/.nex-cli-state");
fs.mkdirSync(cliState, { recursive: true });
const env = { ...process.env, APPDATA: cliState };
const cli = path.join(
  root,
  "node_modules/@webos-tools/cli/bin/ares-package.js",
);
const result = spawnSync(process.execPath, [cli, app, "--outdir", dist], {
  env,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status || 1);
const name = fs.readdirSync(dist).find((name) => name.endsWith(".ipk"));
if (!name) throw new Error("Pacote .ipk não foi gerado.");
const bytes = fs.readFileSync(path.join(dist, name));
fs.writeFileSync(
  path.join(dist, "SHA256SUMS.txt"),
  crypto.createHash("sha256").update(bytes).digest("hex") + "  " + name + "\n",
);
console.log((tv?"Pacote leve para TV: ":"Pacote QA: ") + name + " (" + bytes.length + " bytes)");
