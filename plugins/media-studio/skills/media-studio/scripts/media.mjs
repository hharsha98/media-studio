#!/usr/bin/env node
/**
 * media-studio helper. Cross-platform, uses Remotion's bundled ffmpeg/ffprobe.
 *
 *   node media.mjs probe <file>                         size, duration, fps, loudness (JSON)
 *   node media.mjs sheet <video> <out.png> [--every 2] [--cols 6] [--thumb 320]
 *                                                       contact sheet (frames in a grid) to LOOK at
 *   node media.mjs beats <track|cues.json> [--from 0] [--to 8] [--cuts 2 --total 6]
 *                                                       beat times, strong cues, suggested cut times
 *   node media.mjs stage <path under assets/brag> ... --to music   copy into video/public/<to>/
 *   node media.mjs add --run <run folder> --path <file> --kind image|carousel_pdf|video
 *                      --alt "alt text" [--captions file.srt] [--credit "text"]...
 *                                                       write or update <run>/out/media.json
 *   node media.mjs master <in> <out> [--lufs -14] [--tp -1]
 *                                                       two-pass loudness normalisation (video stream is copied)
 *   node media.mjs ffmpeg ...  |  node media.mjs ffprobe ...     passthrough to Remotion's build
 *
 * Remotion's ffmpeg is a stripped build: no tile, fps, ebur128 or drawtext filters.
 * That is why the contact sheet is drawn in a browser and loudness uses loudnorm.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ASSETS, VIDEO, WS, exists, ffx, findBrowser, loadPlaywright, readJson,
} from "./lib/tools.mjs";
import { LINKEDIN_SOURCES, lintForLinkedin, linkedinSpec } from "./lib/linkedin.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
const flagAll = (name) => rest.flatMap((a, i) => (a === `--${name}` ? [rest[i + 1]] : []));
const positional = () => {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) { i++; continue; }
    out.push(rest[i]);
  }
  return out;
};
const fail = (msg) => { console.error(msg); process.exit(1); };
const round = (n, d = 2) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

// ----------------------------------------------------------------- probing ----
function probe(file) {
  if (!exists(file)) fail("file not found: " + file);
  const sizeBytes = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") {
    const txt = fs.readFileSync(file).toString("latin1");
    const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    const mb = txt.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
    const wPt = mb ? Number(mb[3]) - Number(mb[1]) : null;
    const hPt = mb ? Number(mb[4]) - Number(mb[2]) : null;
    return { kind: "carousel_pdf", pages, width: wPt ? Math.round((wPt * 96) / 72) : null, height: hPt ? Math.round((hPt * 96) / 72) : null, sizeBytes };
  }
  const r = ffx("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (!r.ok) fail("ffprobe failed: " + (r.stderr || r.stdout));
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  const out = { sizeBytes };
  if (v) {
    out.width = v.width; out.height = v.height;
    const [n, d] = String(v.r_frame_rate || "0/1").split("/").map(Number);
    out.fps = d ? round(n / d, 3) : null;
    out.videoCodec = v.codec_name;
  }
  const dur = Number(j.format?.duration);
  const isStill = v && (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp" || ext === ".gif" && !dur);
  out.kind = isStill ? "image" : v ? "video" : "audio";
  if (!isStill && dur) out.durationSec = round(dur, 3);
  if (a) {
    out.audioCodec = a.codec_name;
    const l = ffx("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"]);
    const m = (l.stderr || "").match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
    if (m) {
      try {
        const x = JSON.parse(m[0]);
        out.loudness = { integratedLufs: Number(x.input_i), truePeakDb: Number(x.input_tp), lra: Number(x.input_lra), method: "ffmpeg loudnorm analysis (EBU R128)" };
      } catch { /* ignore */ }
    }
  } else if (out.kind === "video") out.audio = "none";
  return out;
}

// ------------------------------------------------------------ contact sheet ----
async function sheet(video, outPng) {
  const info = probe(video);
  if (!info.durationSec) fail("could not read the duration of " + video);
  let every = Number(flag("every", 2));
  const cols = Number(flag("cols", 6));
  const thumb = Number(flag("thumb", 320));
  while (info.durationSec / every > 48) every *= 2;
  const tmp = path.join(WS, ".tmp", "sheet-" + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const times = [];
  for (let t = 0; t < info.durationSec - 0.05; t += every) times.push(t);
  times.push(Math.max(0, info.durationSec - 0.1));
  const tiles = [];
  times.forEach((t, i) => {
    const f = path.join(tmp, `f${String(i).padStart(3, "0")}.png`);
    const r = ffx("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", `scale=${thumb}:-2`, f]);
    if (r.ok && exists(f)) tiles.push({ t, f });
  });
  const cell = tiles.map(({ t, f }) => `<figure><img src="${pathToFileURL(f).href}"><figcaption>${t.toFixed(1)}s</figcaption></figure>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:12px;background:#111;font:12px system-ui,sans-serif;color:#ddd}
    .g{display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:8px}
    figure{margin:0}img{display:block;width:${thumb}px;border-radius:3px;background:#000}
    figcaption{padding:2px 0}</style>
    <div class="g">${cell}</div>`;
  const htmlPath = path.join(tmp, "sheet.html");
  fs.writeFileSync(htmlPath, html);
  const b = findBrowser();
  if (!b) fail("No browser found. Run /media-studio:setup.");
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: b.path, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: cols * (thumb + 8) + 24, height: 400 } });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
    fs.mkdirSync(path.dirname(path.resolve(outPng)), { recursive: true });
    await page.screenshot({ path: outPng, fullPage: true });
  } finally {
    await browser.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${path.resolve(outPng)}  ${tiles.length} frames, one every ${every}s`);
}

// -------------------------------------------------------------------- beats ----
function loadCues(arg) {
  let p = arg;
  if (!exists(p)) {
    const dir = path.join(ASSETS, "music", "cues");
    const stem = exists(dir) ? fs.readdirSync(dir).find((f) => f.endsWith(".json") && f.includes(arg.replace(/\.mp3$/, ""))) : null;
    if (!stem) fail("no cue file found for '" + arg + "'. Run /media-studio:setup first, or pass a cues .json path.");
    p = path.join(dir, stem);
  }
  const j = readJson(p);
  if (!j?.beats) fail("not a cue file: " + p);
  return j;
}

function beats(arg) {
  const j = loadCues(arg);
  const from = Number(flag("from", 0));
  const to = Number(flag("to", 8));
  const inWin = (x) => x.time >= from && x.time <= to;
  const result = {
    tempoBpm: j.tempo,
    beats: j.beats.filter(inWin).map((b) => round(b.time)),
    strongCues: j.strongCues.filter(inWin).map((c) => ({ time: round(c.time), intensity: round(c.intensity), kind: c.kind })),
  };
  const k = flag("cuts");
  if (k) {
    const K = Number(k);
    const total = Number(flag("total", to));
    // Candidates are beats near an even split; a strong cue wins a close call.
    // Scenes stay at least 1.4 s long so every line can be read.
    const minLen = Number(flag("min-scene", 1.4));
    const strongAt = new Map(j.strongCues.map((c) => [round(c.time), c.intensity]));
    const picked = [];
    for (let i = 1; i <= K; i++) {
      const target = (total * i) / (K + 1);
      const prev = picked.length ? picked[picked.length - 1] : 0;
      const cands = j.beats
        .map((b) => ({ t: round(b.time), strong: strongAt.get(round(b.time)) ?? 0 }))
        .filter((c) => c.t - prev >= minLen && total - c.t >= minLen * (K - i + 1) && Math.abs(c.t - target) <= 0.6);
      cands.sort((a, b) => (Math.abs(a.t - target) - (a.strong ? 0.25 : 0)) - (Math.abs(b.t - target) - (b.strong ? 0.25 : 0)));
      if (cands[0]) picked.push(cands[0].t);
    }
    picked.sort((a, b) => a - b);
    result.suggestedCuts = picked;
    const edges = [0, ...picked, total];
    result.sceneSeconds = edges.slice(1).map((e, i) => round(e - edges[i]));
    result.note = "Cuts sit on the beat grid (a strong cue wins a close call) and scenes stay long enough to read. musicStartSec stays 0 so these times match the track.";
  }
  // compact output: short arrays on one line so they are easy to read
  console.log(`{\n  "tempoBpm": ${result.tempoBpm},\n  "beats": ${JSON.stringify(result.beats)},\n  "strongCues": ${JSON.stringify(result.strongCues.map((c) => `${c.time}s (${c.intensity}, ${c.kind})`))}` +
    (result.suggestedCuts ? `,\n  "suggestedCuts": ${JSON.stringify(result.suggestedCuts)},\n  "sceneSeconds": ${JSON.stringify(result.sceneSeconds)},\n  "note": ${JSON.stringify(result.note)}` : "") + "\n}");
}

// ----------------------------------------------------------------- staging ----
function stage() {
  const files = positional();
  const to = flag("to", "music");
  if (!files.length) fail("usage: media.mjs stage <path under assets/brag> ... --to music");
  const destDir = path.join(VIDEO, "public", to);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    let src = path.isAbsolute(f) ? f : path.join(ASSETS, f);
    if (!exists(src)) {
      // allow a bare track name or a name without the folder
      const guess = ["music", "sfx/ui", "sfx/interface", "sfx/impact", "sfx/casino", "sfx/keyboard"].map((d) => path.join(ASSETS, d, f)).find(exists);
      if (!guess) fail("not found under " + ASSETS + ": " + f);
      src = guess;
    }
    const dest = path.join(destDir, path.basename(src));
    fs.copyFileSync(src, dest);
    console.log(`${to}/${path.basename(src)}   (use as staticFile("${to}/${path.basename(src)}"))`);
  }
}

// ---------------------------------------------------------------- media.json ----
function add() {
  const run = flag("run");
  const file = flag("path");
  const kindArg = flag("kind");
  const alt = flag("alt");
  if (!run || !file || !alt) fail('usage: media.mjs add --run <run folder> --path <file> --kind image|carousel_pdf|video --alt "alt text"');
  const abs = path.resolve(file);
  const info = probe(abs);
  const kind = kindArg || info.kind;
  if (!["image", "carousel_pdf", "video"].includes(kind)) fail("kind must be image, carousel_pdf or video");
  const entry = {
    path: path.relative(path.resolve(run), abs).split(path.sep).join("/"),
    absolutePath: abs,
    kind,
    width: info.width ?? null,
    height: info.height ?? null,
    ...(info.durationSec != null ? { durationSec: info.durationSec } : {}),
    sizeBytes: info.sizeBytes,
    ...(info.pages ? { pages: info.pages } : {}),
    ...(info.loudness ? { loudness: info.loudness } : {}),
    altText: alt,
    ...(flag("captions") ? { captionsSrt: flag("captions") } : {}),
    credits: flagAll("credit"),
    linkedinSpec: linkedinSpec(kind),
  };
  entry.linkedinWarnings = lintForLinkedin(entry);
  const outDir = path.join(path.resolve(run), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const mediaPath = path.join(outDir, "media.json");
  const list = readJson(mediaPath, []);
  const next = list.filter((e) => e.path !== entry.path).concat(entry);
  fs.writeFileSync(mediaPath, JSON.stringify(next, null, 2) + "\n");
  console.log(`wrote ${mediaPath} (${next.length} entr${next.length === 1 ? "y" : "ies"})`);
  for (const w of entry.linkedinWarnings) console.log("WARNING: " + w);
  console.log(`LinkedIn limits read ${LINKEDIN_SOURCES.asOf}; sources are listed in flows/linkedin.md`);
}

// ------------------------------------------------------------------ master ----
function master(inp, out) {
  const I = Number(flag("lufs", -14));
  const TP = Number(flag("tp", -1));
  const info = probe(inp);
  if (!info.audioCodec) fail("no audio stream in " + inp);
  const pass1 = ffx("ffmpeg", ["-hide_banner", "-nostats", "-i", inp, "-vn", "-af", `loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json`, "-f", "null", "-"]);
  const m = (pass1.stderr || "").match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!m) fail("could not measure loudness:\n" + (pass1.stderr || "").slice(-600));
  const x = JSON.parse(m[0]);
  const filter = `loudnorm=I=${I}:TP=${TP}:LRA=11:measured_I=${x.input_i}:measured_TP=${x.input_tp}:measured_LRA=${x.input_lra}:measured_thresh=${x.input_thresh}:offset=${x.target_offset}:linear=true`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", inp];
  if (info.kind === "video") args.push("-c:v", "copy");
  args.push("-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out);
  const r = ffx("ffmpeg", args);
  if (!r.ok) fail("ffmpeg failed: " + (r.stderr || r.stdout));
  const after = probe(out);
  console.log(`before: ${x.input_i} LUFS, true peak ${x.input_tp} dB`);
  console.log(`after:  ${after.loudness?.integratedLufs} LUFS, true peak ${after.loudness?.truePeakDb} dB  ->  ${path.resolve(out)}`);
}

// --------------------------------------------------------------------- main ----
switch (cmd) {
  case "probe": console.log(JSON.stringify(probe(positional()[0] || fail("usage: media.mjs probe <file>")), null, 2)); break;
  case "sheet": { const [v, o] = positional(); if (!v || !o) fail("usage: media.mjs sheet <video> <out.png>"); await sheet(v, o); break; }
  case "beats": beats(positional()[0] || fail("usage: media.mjs beats <track name or cues.json>")); break;
  case "stage": stage(); break;
  case "add": add(); break;
  case "master": { const [i, o] = positional(); if (!i || !o) fail("usage: media.mjs master <in> <out> [--lufs -14] [--tp -1]"); master(i, o); break; }
  case "ffmpeg":
  case "ffprobe": {
    const r = ffx(cmd, process.argv.slice(3), { inherit: true });
    process.exit(r.status ?? 1);
    break;
  }
  default:
    console.error(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*\n?/, "").replace(/^ \* ?/gm, ""));
    process.exit(cmd ? 1 : 0);
}
