#!/usr/bin/env node
/**
 * media-studio setup. Works on macOS, Windows and Linux. Needs only Node 18+.
 * No global installs: everything goes into one workspace folder
 * (default ~/MediaStudio, override with MEDIA_STUDIO_HOME).
 *
 *   node setup.mjs              ask before every download
 *   node setup.mjs --yes        approve every download up front
 *   node setup.mjs --only=assets,remotion   run only some steps
 *   node setup.mjs --no-sfx     skip the sound-effects library (2.5 MB)
 *   node setup.mjs --refresh-template   copy the plugin's Remotion template over video/ again
 *
 * Steps (each one is skipped when already done, so re-running is safe):
 *   workspace   create the folder and a package.json
 *   playwright  npm i playwright-core   (drives your installed Chrome or Edge for still images)
 *   remotion    copy the pinned Remotion project and npm install it
 *   browser     npx remotion browser ensure   (Chrome Headless Shell, used for rendering)
 *   stills      find a browser for still images; offer a Playwright download only if none exists
 *   assets      download music, beat files and sound effects from the pinned upstream commit
 *               and check every file's SHA-256 against assets-manifest.json
 *
 * Exit codes: 0 ready, 1 a step failed, 2 a step is waiting for your approval (re-run with --yes).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  ASSETS, PINNED, TEMPLATE_DIR, VIDEO, WEB, WS, exists, findBrowser, fmtBytes, installedRemotionVersion,
  loadManifest, npm, readJson, remotion, remotionHeadlessShell, templateRemotionVersion, writeState,
} from "./lib/tools.mjs";
import { collectChecks, printTable } from "./lib/checks.mjs";

const argv = process.argv.slice(2);
const YES = argv.includes("--yes") || argv.includes("-y");
const SKIP_SFX = argv.includes("--no-sfx");
const REFRESH = argv.includes("--refresh-template");
const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean) : null;
const want = (id) => !ONLY || ONLY.includes(id);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*\n?/, "").replace(/^ \* ?/gm, ""));
  process.exit(0);
}

let waiting = false;
let failed = false;

async function confirm(question) {
  if (YES) return true;
  if (!process.stdin.isTTY) {
    console.log(`  ? ${question}`);
    console.log("    Not an interactive terminal, so I will not guess. Ask the user, then re-run with --yes.");
    waiting = true;
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`  ? ${question} [y/N] `, r));
  rl.close();
  if (/^y(es)?$/i.test(answer.trim())) return true;
  waiting = true;
  return false;
}

let stepNo = 0;
const step = (title) => console.log(`\n[${++stepNo}] ${title}`);
const note = (msg) => console.log(`    ${msg}`);

// ------------------------------------------------------------------ node ----
const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`Node 18 or newer is required (you have v${process.versions.node}). Install it from https://nodejs.org and re-run.`);
  process.exit(1);
}
console.log(`media-studio setup\n  workspace: ${WS}\n  platform:  ${process.platform} ${process.arch}, Node v${process.versions.node}`);

// ------------------------------------------------------------- workspace ----
if (want("workspace")) {
  step("Workspace folder");
  for (const d of [WS, path.join(WS, "runs"), WEB]) fs.mkdirSync(d, { recursive: true });
  const pkg = path.join(WS, "package.json");
  if (!exists(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: "media-studio-workspace", version: "1.0.0", private: true }, null, 2) + "\n");
    note("created package.json");
  }
  note(`ready: ${WS}`);
}

// ------------------------------------------------------------ playwright ----
if (want("playwright")) {
  step("playwright-core (about 13 MB; drives Chrome or Edge for still images, it downloads NO browser)");
  const have = exists(path.join(WS, "node_modules", "playwright-core", "package.json"));
  if (have) note("already installed");
  else if (await confirm("Install playwright-core into the workspace (about 13 MB)?")) {
    const r = npm(["i", "-D", "--save-exact", `playwright-core@${PINNED.playwrightCore}`, "--no-audit", "--no-fund"], WS, { inherit: true });
    if (!r.ok) { failed = true; note("npm failed. Check your network and re-run."); } else note("installed");
  }
}

// --------------------------------------------------------------- remotion ----
if (want("remotion")) {
  step("Remotion video project (about 300 MB on disk, pinned exact versions)");
  const pinned = templateRemotionVersion();
  const haveDeps = Boolean(installedRemotionVersion());
  if (haveDeps && REFRESH) {
    // Never run npm ci here: it would delete node_modules, including the downloaded Chrome Headless Shell.
    for (const f of ["src", "remotion.config.ts", "tsconfig.json"]) fs.cpSync(path.join(TEMPLATE_DIR, f), path.join(VIDEO, f), { recursive: true });
    note("template source files refreshed (src/, remotion.config.ts, tsconfig.json). Package versions were left alone.");
  } else if (haveDeps) {
    note(`already installed (remotion ${installedRemotionVersion()}; this plugin pins ${pinned})`);
  } else if (await confirm(`Copy the Remotion template to ${VIDEO} and run npm install (about 300 MB, 1 to 3 minutes)?`)) {
    fs.cpSync(TEMPLATE_DIR, VIDEO, {
      recursive: true,
      filter: (src) => !/[\\/]node_modules([\\/]|$)/.test(src) && !/[\\/]out([\\/]|$)/.test(src),
    });
    const lock = exists(path.join(VIDEO, "package-lock.json"));
    const r = npm([lock ? "ci" : "install", "--no-audit", "--no-fund", "--loglevel=error"], VIDEO, { inherit: true });
    if (!r.ok) { failed = true; note("npm failed. Check your network and re-run."); }
    else note(`installed remotion ${installedRemotionVersion()}`);
  }
}

// ---------------------------------------------------------------- browser ----
if (want("browser")) {
  step("Remotion's Chrome Headless Shell (about 171 MB download, about 580 MB on disk)");
  if (!installedRemotionVersion()) note("skipped: the Remotion project is not installed yet");
  else if (remotionHeadlessShell()) note(`already downloaded: ${remotionHeadlessShell()}`);
  else if (await confirm("Download Remotion's Chrome Headless Shell (about 171 MB)? Rendering needs it.")) {
    const r = remotion(["browser", "ensure"], { inherit: true });
    if (!r.ok) {
      failed = true;
      note("download failed. On Linux, Chrome needs system libraries; see https://www.remotion.dev/docs/miscellaneous/linux-dependencies");
    }
  }
}

// ----------------------------------------------------------------- stills ----
if (want("stills")) {
  step("Browser for still images, captures and contact sheets");
  let b = findBrowser();
  if (b) note(`using ${b.kind}: ${b.path}`);
  else if (exists(path.join(WS, "node_modules", "playwright-core"))) {
    if (await confirm("No Chrome, Edge or Chromium found. Download Playwright's headless Chromium (about 100 MB)?")) {
      const exe = process.platform === "win32" ? "npx.cmd" : "npx";
      const r = (await import("node:child_process")).spawnSync(exe, ["playwright-core", "install", "chromium-headless-shell"], { cwd: WS, stdio: "inherit", shell: process.platform === "win32" });
      if (r.status !== 0) failed = true;
      b = findBrowser();
      if (b) note(`using ${b.kind}: ${b.path}`);
    }
  } else note("skipped: playwright-core is not installed yet");
}

// ----------------------------------------------------------------- assets ----
async function download(url, dest, sha, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const got = crypto.createHash("sha256").update(buf).digest("hex");
      if (got !== sha) throw new Error(`SHA-256 mismatch (expected ${sha.slice(0, 12)}..., got ${got.slice(0, 12)}...)`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest + ".part", buf);
      fs.renameSync(dest + ".part", dest);
      return;
    } catch (e) {
      last = e;
      if (/mismatch/.test(String(e.message))) break; // never retry a hash mismatch
    }
  }
  throw last;
}

if (want("assets")) {
  step("Music, beat files and sound effects (downloaded from the pinned upstream commit, hashes verified)");
  let manifest;
  try { manifest = loadManifest(); } catch (e) { console.error(e.message); process.exit(1); }
  note(`source: https://github.com/${manifest.source.repo} @ ${manifest.source.commit.slice(0, 12)}`);
  for (const [name, group] of Object.entries(manifest.groups)) {
    if (name === "sfx" && SKIP_SFX) { note(`${name}: skipped (--no-sfx)`); continue; }
    const missing = group.files.filter((f) => {
      const p = path.join(ASSETS, f.path);
      if (!exists(p)) return true;
      try { return fs.statSync(p).size !== f.bytes || crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") !== f.sha256; } catch { return true; }
    });
    if (!missing.length) { note(`${name}: all ${group.files.length} files present and verified`); continue; }
    const bytes = missing.reduce((s, f) => s + f.bytes, 0);
    if (!(await confirm(`${group.label}: download ${missing.length} file(s), ${fmtBytes(bytes)}? (${group.license})`))) continue;
    let done = 0;
    const queue = [...missing];
    const errors = [];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        try { await download(manifest.source.urlBase + f.path, path.join(ASSETS, f.path), f.sha256); }
        catch (e) { errors.push(`${f.path}: ${e.message}`); }
        done++;
        if (done % 25 === 0 || done === missing.length) note(`${name}: ${done}/${missing.length}`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (errors.length) {
      failed = true;
      console.error(`    ${errors.length} file(s) failed:`);
      for (const e of errors.slice(0, 8)) console.error("      " + e);
    } else note(`${name}: ${missing.length} file(s) downloaded and verified`);
  }
  // Credits that must travel with the files
  if (!exists(path.join(ASSETS, "music"))) { /* nothing downloaded yet: no credits file */ } else {
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.writeFileSync(path.join(ASSETS, "CREDITS.md"), [
    "# Credits for the fetched media files",
    "",
    "These files are downloaded by media-studio from https://github.com/" + manifest.source.repo + " at commit " + manifest.source.commit + ".",
    "They are not part of the media-studio repository.",
    "",
    ...Object.entries(manifest.groups).map(([n, g]) => `- ${n}: ${g.label}. Licence: ${g.license}.${g.credit ? " Credit line: \"" + g.credit + "\"." : ""}`),
    "",
    "Music source and licence statement: https://ende.app/en (everything there is CC BY 4.0, commercial use allowed). Keep the credit line in anything you publish.",
    "",
  ].join("\n"));
  }
}

// ------------------------------------------------------------------ state ----
if (!failed) {
  const b = findBrowser();
  writeState({
    setupVersion: readJson(path.join(TEMPLATE_DIR, "package.json"))?.version ?? "1.0.0",
    remotion: installedRemotionVersion(),
    browser: b ? { kind: b.kind, path: b.path } : null,
    platform: process.platform,
  });
}

// ----------------------------------------------------------------- report ----
const rows = await collectChecks();
const ready = printTable(rows, "media-studio readiness (after setup)");
if (failed) { console.log("At least one step failed (see above). Fix it and re-run; finished steps are skipped.\n"); process.exit(1); }
if (waiting) { console.log("Some downloads were not approved yet. After the user says yes, re-run with --yes.\n"); process.exit(2); }
process.exit(ready ? 0 : 1);
