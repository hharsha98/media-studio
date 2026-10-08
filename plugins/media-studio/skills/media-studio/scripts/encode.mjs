#!/usr/bin/env node
/**
 * Node port of scroll-craft's encode.sh (bash), so it works on Windows too.
 * Encodes a clip for SCRUBBING (dense keyframes), not for playback. Audio is stripped.
 *
 *   node encode.mjs in.mp4 out.mp4                desktop master (1080p, GOP 8, CRF 20)
 *   node encode.mjs in.mp4 out-m.mp4 mobile       phone variant   (720p,  GOP 4, CRF 24)
 *   node encode.mjs in.mp4 out.mp4 desktop 23     CRF override (grainy footage wants 22-23)
 *
 * Uses Remotion's bundled ffmpeg (stripped build: scale and libx264 exist, which is all this needs).
 */
import fs from "node:fs";
import path from "node:path";
import { ffx, fmtBytes } from "./lib/tools.mjs";

const [inp, out, mode = "desktop", crfArg] = process.argv.slice(2);
if (!inp || !out) {
  console.error("usage: node encode.mjs <in> <out> [mobile|desktop] [crf]");
  process.exit(1);
}
const mobile = mode === "mobile";
const scale = mobile ? 720 : 1080;
const gop = mobile ? 4 : 8;
const crf = String(crfArg ?? process.env.SCROLLCRAFT_CRF ?? (mobile ? 24 : 20));
if (!/^\d+$/.test(crf)) {
  console.error(`crf must be an integer, got '${crf}'`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const r = ffx("ffmpeg", [
  "-y", "-hide_banner", "-loglevel", "error", "-i", inp, "-an",
  "-vf", `scale=-2:${scale}:flags=lanczos`, "-pix_fmt", "yuv420p",
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", crf,
  "-g", String(gop), "-keyint_min", String(gop), "-sc_threshold", "0",
  "-movflags", "+faststart", out,
]);
if (!r.ok) {
  console.error(r.stderr || r.stdout || "ffmpeg failed");
  process.exit(1);
}
const p = ffx("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
console.log(`${out}  ${fmtBytes(fs.statSync(out).size)}  ${(p.stdout || "").trim()}s  gop=${gop}  crf=${crf}`);
