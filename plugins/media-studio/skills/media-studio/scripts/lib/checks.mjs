// Read-only readiness checks, shared by check.mjs and setup.mjs.
// Installs nothing, starts nothing, writes nothing, never opens a .env file.
// The only network call is one GET to the VoiceStudio health URL on this machine.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ASSETS, VIDEO, WS, exists, ffx, findBrowser, fmtBytes, installedRemotionVersion, isWin, loadManifest,
  remotionCliPath, remotionHeadlessShell, run, systemFfmpeg, templateRemotionVersion,
} from "./tools.mjs";

export const VOICESTUDIO_URL = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";

export async function collectChecks({ voice = true } = {}) {
  const rows = [];
  const add = (level, name, ok, detail, fix = "") => rows.push({ level, name, ok, detail, fix });

  // Node
  const major = Number(process.versions.node.split(".")[0]);
  add("required", "Node.js", major >= 18, `v${process.versions.node}`, "Install Node 18 or newer from nodejs.org.");

  // Workspace
  add("required", "workspace", exists(WS), WS, "Run /media-studio:setup.");

  // playwright-core
  let pw = false;
  try { createRequire(path.join(WS, "package.json"))("playwright-core"); pw = true; } catch { /* missing */ }
  add("required", "playwright-core", pw, pw ? "installed in the workspace" : "not installed", "Run /media-studio:setup.");

  // Remotion project + CLI
  const have = installedRemotionVersion();
  const want = templateRemotionVersion();
  const cli = remotionCliPath();
  add("required", "Remotion project", Boolean(have && cli),
    have ? `${VIDEO}  remotion ${have}${want && have !== want ? `  (plugin template pins ${want})` : ""}` : `${VIDEO} not set up`,
    "Run /media-studio:setup.");

  // Remotion's bundled ffmpeg / ffprobe
  if (cli) {
    const v = ffx("ffmpeg", ["-version"], { timeout: 30000 });
    const first = (v.stdout.split("\n")[0] || "").trim();
    add("required", "ffmpeg (bundled with Remotion)", v.ok && /ffmpeg version/i.test(first), v.ok ? first : "does not run", "Run /media-studio:setup, or reinstall the Remotion project.");
    const p = ffx("ffprobe", ["-version"], { timeout: 30000 });
    add("required", "ffprobe (bundled with Remotion)", p.ok, p.ok ? (p.stdout.split("\n")[0] || "").trim() : "does not run", "Run /media-studio:setup.");
  } else {
    add("required", "ffmpeg (bundled with Remotion)", false, "Remotion not installed yet", "Run /media-studio:setup.");
  }
  const sys = systemFfmpeg();
  add("optional", "system ffmpeg (full build)", Boolean(sys), sys ? `${sys}  (optional faster path; needed only by the scroll-craft web flow)` : "none found",
    "Optional. Needed only for the website flow. macOS: brew install ffmpeg. Windows: winget install Gyan.FFmpeg. Linux: apt install ffmpeg.");

  // Chrome Headless Shell (Remotion renders with it)
  const shell = remotionHeadlessShell();
  add("required", "Remotion Chrome Headless Shell", Boolean(shell), shell ? shell : "not downloaded yet", "Run /media-studio:setup (about 171 MB download).");

  // Browser for stills, captures, contact sheets
  const b = findBrowser();
  add("required", "browser for stills", Boolean(b), b ? `${b.kind}: ${b.path}` : "none found", "Run /media-studio:setup, or install Google Chrome.");

  // Fetched assets (music, cues, SFX)
  let manifest = null;
  try { manifest = loadManifest(); } catch (e) { add("required", "assets manifest", false, e.message, "Reinstall the plugin."); }
  if (manifest) {
    for (const [name, g] of Object.entries(manifest.groups)) {
      const present = g.files.filter((f) => {
        try { return fs.statSync(path.join(ASSETS, f.path)).size === f.bytes; } catch { return false; }
      }).length;
      const ok = present === g.files.length;
      add(name === "sfx" ? "optional" : "required", `assets: ${name}`, ok, `${present}/${g.files.length} files${ok ? "" : "  (" + g.label + ")"}`,
        "Run /media-studio:setup (it verifies SHA-256 hashes against the pinned upstream commit).");
    }
  }

  // Optional: uv (only for the beat-analysis script on custom tracks)
  const uv = run(isWin ? "uv.exe" : "uv", ["--version"], { timeout: 10000 });
  add("optional", "uv (custom-track beat analysis)", uv.ok, uv.ok ? uv.stdout.trim() : "not installed", "Optional. Bundled tracks already have beat files. See flows/teaser.md.");

  // Optional: VoiceStudio (reported, never started)
  if (voice) {
    try {
      const r = await fetch(`${VOICESTUDIO_URL}/health`, { signal: AbortSignal.timeout(1500) });
      const body = (await r.text()).slice(0, 100).replace(/\s+/g, " ");
      add("optional", "VoiceStudio (narration)", r.ok, r.ok ? `${VOICESTUDIO_URL} reachable  ${body}` : `${VOICESTUDIO_URL} answered HTTP ${r.status}`,
        "Optional. Install VoiceStudio yourself and start it; see flows/voice.md. Otherwise use your own recording or captions only.");
    } catch {
      add("optional", "VoiceStudio (narration)", false, `${VOICESTUDIO_URL} not reachable`,
        "Optional. Install VoiceStudio yourself and start it; see flows/voice.md. Otherwise use your own recording or captions only.");
    }
  }

  // Disk
  try {
    const st = fs.statfsSync(exists(WS) ? WS : path.dirname(WS));
    const free = Number(st.bavail) * Number(st.bsize);
    add("required", "free disk space", free > 3 * 1024 ** 3, fmtBytes(free) + " free", "Setup needs about 1.5 GB; renders need a little more.");
  } catch { /* statfs not available */ }

  return rows;
}

export function printTable(rows, title = "media-studio readiness") {
  const mark = (r) => (r.ok ? "ok  " : r.level === "required" ? "FAIL" : "skip");
  const w = Math.max(...rows.map((r) => r.name.length));
  console.log(`\n${title}\n`);
  for (const r of rows) {
    console.log(` [${mark(r)}] ${r.name.padEnd(w)}  ${r.detail}`);
    if (!r.ok && r.fix) console.log(`        -> ${r.fix}`);
  }
  const hard = rows.filter((r) => !r.ok && r.level === "required").length;
  const soft = rows.filter((r) => !r.ok && r.level !== "required").length;
  console.log("");
  if (hard) console.log(`${hard} required item(s) missing. Run /media-studio:setup, then check again.\n`);
  else console.log(soft ? `Ready. ${soft} optional item(s) not available (marked skip); only the flows that use them are limited.\n` : "Ready.\n");
  return hard === 0;
}
