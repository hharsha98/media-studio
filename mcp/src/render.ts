import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pageCaptions, type CaptionPage } from "./captions.js";
import { MUSIC_CREDIT, log, musicDir, remotionSource, remotionTarget, videoProject } from "./config.js";
import type { Scene, Source, VideoPlan } from "./plan.js";
import { STYLES, resolveTheme } from "./styles.js";

export const FPS = 30;
export const SIZES = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] } as const;

export interface SceneTiming {
  id: string;
  audioSeconds: number;
  durationFrames: number;
  startFrame: number;
  leadFrames: number;
  pages: CaptionPage[];
}

/** Scene length = audio + lead + tail; title >= 2.5 s; end card 3.5 s (longer when narrated). */
export function layoutScenes(plan: VideoPlan, audio: Record<string, number>): SceneTiming[] {
  const preset = STYLES[plan.style];
  let start = 0;
  return plan.scenes.map((s) => {
    const a = audio[s.id] ?? 0;
    let sec = a > 0 ? a + preset.leadSeconds + preset.tailSeconds : 0;
    if (s.kind === "title") sec = Math.max(sec, 2.5);
    if (s.kind === "end") sec = Math.max(sec, 3.5);
    if (sec === 0) sec = 3;
    const durationFrames = Math.round(sec * FPS);
    const t: SceneTiming = {
      id: s.id,
      audioSeconds: a,
      durationFrames,
      startFrame: start,
      leadFrames: Math.round(preset.leadSeconds * FPS),
      pages: a > 0 ? pageCaptions(s.narration, a) : [],
    };
    start += durationFrames;
    return t;
  });
}

/** All caption pages with absolute times (seconds), for the SRT file. */
export function absolutePages(plan: VideoPlan, timings: SceneTiming[]): CaptionPage[] {
  const lead = STYLES[plan.style].leadSeconds;
  return timings.flatMap((t) =>
    t.pages.map((p) => ({ ...p, start: t.startFrame / FPS + lead + p.start, end: t.startFrame / FPS + lead + p.end })),
  );
}

const domain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
export const sourceLabel = (s: Source): string => s.publisher || domain(s.url);

export interface PropsInput {
  plan: VideoPlan;
  timings: SceneTiming[];
  voiceLabel: string | null;
  musicFile: string | null;
}

/** Everything the composition needs. Pure data: nothing topic-specific lives in the composition code. */
export function buildProps(i: PropsInput): Record<string, unknown> {
  const { plan, timings } = i;
  const preset = STYLES[plan.style];
  const [width, height] = SIZES[plan.format];
  const cited = new Set(plan.scenes.flatMap((s) => s.source_ids ?? []));
  const ordered = [...plan.sources].sort((a, b) => Number(cited.has(b.id)) - Number(cited.has(a.id)));
  const byId = new Map(plan.sources.map((s) => [s.id, s]));
  return {
    format: plan.format,
    width,
    height,
    fps: FPS,
    theme: resolveTheme(plan.style, plan.theme),
    motion: preset.motion,
    labels: {
      aiVoice: i.voiceLabel !== null,
      narration: i.voiceLabel ? `Narration: AI voice (${i.voiceLabel})` : null,
      music: i.musicFile ? MUSIC_CREDIT : null,
      madeWith: "Made with Media Studio MCP",
    },
    music: i.musicFile ? { src: i.musicFile, volume: 0.12 } : null,
    sources: ordered.slice(0, 4).map((s) => ({ publisher: sourceLabel(s), title: s.title })),
    scenes: plan.scenes.map((s: Scene, idx: number) => {
      const t = timings[idx];
      const tag = [...new Set((s.source_ids ?? []).map((id) => byId.get(id)).filter(Boolean).map((x) => sourceLabel(x!)))].join(", ");
      return {
        ...s,
        durationFrames: t.durationFrames,
        leadFrames: t.leadFrames,
        audio: t.audioSeconds > 0 ? `voice/${s.id}.wav` : null,
        sourceTag: tag ? `Source: ${tag}` : null,
        captions: t.pages.map((p) => ({
          lines: p.lines,
          from: t.leadFrames + Math.round(p.start * FPS),
          to: t.leadFrames + Math.round(p.end * FPS),
        })),
      };
    }),
  };
}

/** Pick a music track (first mp3 by name) and copy it into the run's public folder. */
export function stageMusic(runPublic: string): string | null {
  try {
    const files = fs.readdirSync(musicDir()).filter((f) => f.toLowerCase().endsWith(".mp3")).sort();
    if (!files.length) return null;
    fs.mkdirSync(path.join(runPublic, "music"), { recursive: true });
    fs.copyFileSync(path.join(musicDir(), files[0]), path.join(runPublic, "music", "track.mp3"));
    return "music/track.mp3";
  } catch {
    return null;
  }
}

/** Copy mcp/remotion/** into <video project>/src/media-studio-mcp/, only files that differ. */
export function syncComposition(): { copied: number } {
  const src = remotionSource();
  const dst = remotionTarget();
  let copied = 0;
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(r);
      else {
        const from = path.join(src, r);
        const to = path.join(dst, r);
        const a = fs.readFileSync(from);
        if (!fs.existsSync(to) || !a.equals(fs.readFileSync(to))) {
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.writeFileSync(to, a);
          copied++;
        }
      }
    }
  };
  walk("");
  return { copied };
}

export const defaultConcurrency = () => Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

export interface RemotionRun {
  code: number;
  tail: string;
}

/** Run `npx --no-install remotion <args>` in the video project; stdout/stderr piped, never inherited. */
export function runRemotion(args: string[], onProgress?: (done: number, total: number) => void): Promise<RemotionRun> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--no-install", "remotion", ...args], {
      cwd: videoProject(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1" },
    });
    let tail = "";
    const onData = (b: Buffer) => {
      const s = b.toString();
      tail = (tail + s).slice(-4000);
      const m = [...s.matchAll(/Rendered\s+(\d+)\/(\d+)/g)].pop();
      if (m && onProgress) onProgress(Number(m[1]), Number(m[2]));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (e) => resolve({ code: 1, tail: `could not start remotion: ${e.message}` }));
    child.on("close", (code) => {
      log(`remotion ${args[0]} exited ${code}`);
      resolve({ code: code ?? 1, tail });
    });
  });
}

/** Run a script with node, stdout/stderr captured. */
export function runNode(script: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b));
    child.stderr.on("data", (b) => (stderr += b));
    child.on("error", (e) => resolve({ code: 1, stdout, stderr: e.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
