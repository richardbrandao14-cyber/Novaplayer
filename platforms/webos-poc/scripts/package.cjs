const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const dist = path.join(root, "dist");
const app = path.join(dist, "app");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(root, "app"), app, { recursive: true });
fs.copyFileSync(path.join(repo, "LICENSE"), path.join(app, "LICENSE"));
fs.mkdirSync(path.join(app, "media/hls"), { recursive: true });
fs.copyFileSync(
  path.join(repo, "src-tauri/tests/fixtures/player-av.mp4"),
  path.join(app, "media/player-av.mp4"),
);
fs.cpSync(
  path.join(repo, "src-tauri/tests/fixtures/player-hls"),
  path.join(app, "media/hls"),
  { recursive: true },
);
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
console.log("Pacote de teste: " + name + " (" + bytes.length + " bytes)");
