// Shared helpers for media-studio scripts. Plain Node (>= 18), no dependencies,
// works on macOS, Windows and Linux. Nothing here writes anything by itself.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** .../skills/media-studio */
export const SKILL_DIR = path.resolve(HERE, "..", "..");
/** the plugin root (parent of skills/ and commands/) */
export const PLUGIN_ROOT = path.resolve(SKILL_DIR, "..", "..");
export const TEMPLATE_DIR = path.join(SKILL_DIR, "templates", "remotion");
export const MANIFEST_PATH = path.join(SKILL_DIR, "assets-manifest.json");

/** The workspace. Default ~/MediaStudio on every OS; override with MEDIA_STUDIO_HOME. */
export const WS = process.env.MEDIA_STUDIO_HOME
  ? path.resolve(process.env.MEDIA_STUDIO_HOME)
  : path.join(os.homedir(), "MediaStudio");
export const VIDEO = path.join(WS, "video");
export const ASSETS = path.join(WS, "assets", "brag");
export const RUNS = path.join(WS, "runs");
export const WEB = path.join(WS, "web");
export const STATE_FILE = path.join(WS, ".media-studio.json");

export const PINNED = { playwrightCore: "1.64.0" };

export const exists = (p) => {
  try { return fs.existsSync(p); } catch { return false; }
};

export function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

export function fmtBytes(n) {
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(1) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
  if (n >= 1024) return Math.round(n / 1024) + " KB";
  return n + " B";
}

export function sha256File(p) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}

/** Run a program and capture output. Never throws. */
export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: opts.timeout ?? 0,
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    shell: Boolean(opts.shell),
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error };
}

/** npm (npm.cmd on Windows needs a shell; keep arguments free of spaces). */
export function npm(args, cwd, opts = {}) {
  return run(isWin ? "npm.cmd" : "npm", args, { cwd, shell: isWin, inherit: opts.inherit, timeout: opts.timeout });
}

// ---------------------------------------------------------------- Remotion --

export function remotionCliPath() {
  const p = path.join(VIDEO, "node_modules", "@remotion", "cli", "remotion-cli.js");
  return exists(p) ? p : null;
}

/** Run the Remotion CLI inside the workspace video project (no npx, no global install). */
export function remotion(args, opts = {}) {
  const cli = remotionCliPath();
  if (!cli) return { ok: false, status: null, stdout: "", stderr: "Remotion is not installed in " + VIDEO + ". Run /media-studio:setup.", error: new Error("no remotion") };
  return run(process.execPath, [cli, ...args], { cwd: VIDEO, inherit: opts.inherit, timeout: opts.timeout });
}

export function installedRemotionVersion() {
  const pkg = readJson(path.join(VIDEO, "node_modules", "remotion", "package.json"));
  return pkg?.version ?? null;
}

export function templateRemotionVersion() {
  return readJson(path.join(TEMPLATE_DIR, "package.json"))?.dependencies?.remotion ?? null;
}

/** Remotion's Chrome Headless Shell, if downloaded. */
export function remotionHeadlessShell() {
  const base = path.join(VIDEO, "node_modules", ".remotion", "chrome-headless-shell");
  if (!exists(base)) return null;
  const exe = isWin ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  const stack = [base];
  for (let guard = 0; stack.length && guard < 400; guard++) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === exe) return full;
      if (e.isDirectory()) stack.push(full);
    }
  }
  return null;
}

// ------------------------------------------------------------------ ffmpeg --

let _sysFfmpeg;
/** A FULL system ffmpeg (more than 200 filters), or null. Optional faster path. */
export function systemFfmpeg() {
  if (_sysFfmpeg !== undefined) return _sysFfmpeg;
  const cands = [process.env.MEDIA_STUDIO_FFMPEG, "ffmpeg"].filter(Boolean);
  for (const c of cands) {
    const r = run(c, ["-hide_banner", "-filters"], { timeout: 15000 });
    if (r.ok && r.stdout.split("\n").length > 200) { _sysFfmpeg = c; return c; }
  }
  _sysFfmpeg = null;
  return null;
}

/**
 * Run ffmpeg or ffprobe. Default: Remotion's bundled build (same on every OS).
 * It is a STRIPPED build: scale, concat, loudnorm, amix and volume exist, but
 * tile, fps, ebur128 and drawtext do not. Use -r instead of fps, and loudnorm
 * (print_format=json) instead of ebur128. Pass { system: true } or set
 * MEDIA_STUDIO_USE_SYSTEM_FFMPEG=1 to use a full system build when you have one.
 */
export function ffx(tool, args, opts = {}) {
  const wantSystem = opts.system ?? process.env.MEDIA_STUDIO_USE_SYSTEM_FFMPEG === "1";
  if (wantSystem) {
    const sys = systemFfmpeg();
    if (sys) {
      const exe = tool === "ffprobe" ? sys.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1") : sys;
      return run(exe, args, { timeout: opts.timeout, inherit: opts.inherit });
    }
  }
  return remotion([tool, ...args], opts);
}

// ----------------------------------------------------------------- browser --

/** Find a Chromium-family browser for stills and captures. Order: user override, installed browser, Remotion's shell, Playwright's. */
export function findBrowser() {
  const env = process.env;
  const list = [env.MEDIA_STUDIO_CHROME, env.SCROLLCRAFT_CHROME];
  if (isMac) {
    list.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else if (isWin) {
    const pf = env.PROGRAMFILES || "C:\\Program Files";
    const pf86 = env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const local = env.LOCALAPPDATA || "";
    list.push(
      path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
      local && path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    );
  } else {
    list.push(
      "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium",
      "/usr/bin/chromium-browser", "/snap/bin/chromium", "/usr/bin/microsoft-edge",
    );
  }
  const sys = list.find((p) => p && exists(p));
  if (sys) return { path: sys, kind: "installed browser" };
  const shell = remotionHeadlessShell();
  if (shell) return { path: shell, kind: "Remotion headless shell" };
  try {
    const { chromium } = createRequire(path.join(WS, "package.json"))("playwright-core");
    const p = chromium.executablePath();
    if (p && exists(p)) return { path: p, kind: "Playwright browser" };
  } catch { /* playwright-core not installed yet */ }
  return null;
}

/** playwright-core from the workspace (never from a global install). */
export function loadPlaywright() {
  try {
    return createRequire(path.join(WS, "package.json"))("playwright-core");
  } catch {
    throw new Error("playwright-core is not installed in " + WS + ". Run /media-studio:setup.");
  }
}

// ------------------------------------------------------------------- state --

export function readState() {
  return readJson(STATE_FILE, {});
}

export function writeState(patch) {
  fs.mkdirSync(WS, { recursive: true });
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + "\n");
  return next;
}

export function loadManifest() {
  const m = readJson(MANIFEST_PATH);
  if (!m) throw new Error("assets-manifest.json is missing or invalid: " + MANIFEST_PATH);
  return m;
}

/** Make a run folder path like <workspace>/runs/2026-10-08-my-launch (date is today, local time). */
export function runDir(slug) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clean = String(slug || "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "run";
  return path.join(RUNS, `${stamp}-${clean}`);
}
