import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { toSrt } from "./captions.js";
import { log, mediaScript, runsDir } from "./config.js";
import { estimateSeconds, withEndScene, wordCount, type VideoPlan } from "./plan.js";
import {
  absolutePages, buildProps, defaultConcurrency, layoutScenes, runNode, runRemotion, stageMusic, syncComposition,
} from "./render.js";
import { reportMarkdown, round, type Report, type Usage } from "./report.js";
import { sendTrace } from "./tracing.js";
import { asrInfo, defaultVoice, synthesize, transcribe, voiceInfo, type VoiceSettings } from "./voice.js";
import { wordErrorRate } from "./wer.js";

export type JobState = "queued" | "voice" | "render" | "master" | "measure" | "done" | "failed";

export interface JobRecord {
  job_id: string;
  run_id: string;
  run_dir: string;
  state: JobState;
  step: string;
  progress: number;
  steps: { name: string; seconds: number; started_at: number }[];
  error: string | null;
  created_at: string;
  updated_at: string;
  /** rough wall-clock time for voice + render + master + measure (not the video length) */
  estimated_processing_seconds: number;
  options: { voice?: VoiceSettings; music: boolean; concurrency: number };
  usage: Usage | null;
}

const jobs = new Map<string, JobRecord>();
const bus = new EventEmitter();
bus.setMaxListeners(100);
const queue: { rec: JobRecord; plan: VideoPlan }[] = [];
let running = false;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "video";
const jobFile = (dir: string) => path.join(dir, "job.json");

function persist(rec: JobRecord): void {
  rec.updated_at = new Date().toISOString();
  fs.writeFileSync(jobFile(rec.run_dir), JSON.stringify(rec, null, 2));
}
function change(rec: JobRecord, patch: Partial<JobRecord>, notify = false): void {
  const stepChanged = patch.state !== undefined && patch.state !== rec.state;
  Object.assign(rec, patch);
  persist(rec);
  if (notify || stepChanged) bus.emit("change", rec.job_id);
}

export function submitJob(planIn: VideoPlan, opts: { voice?: VoiceSettings; music?: boolean; concurrency?: number }): JobRecord {
  const plan = withEndScene(planIn);
  const date = new Date().toISOString().slice(0, 10);
  const run_id = `${date}-mcp-${slug(plan.title)}-${randomBytes(2).toString("hex")}`;
  const run_dir = path.join(runsDir(), run_id);
  for (const d of ["brief", "public/voice", "work", "out"]) fs.mkdirSync(path.join(run_dir, d), { recursive: true });
  fs.writeFileSync(path.join(run_dir, "brief", "plan.json"), JSON.stringify(plan, null, 2));
  const rec: JobRecord = {
    job_id: run_id, run_id, run_dir, state: "queued", step: "queued", progress: 0, steps: [], error: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    // measured on an Apple Silicon Mac: about 56 s of work for a 25 s video
    estimated_processing_seconds: Math.round(estimateSeconds(plan.scenes) * 1.6 + 25),
    options: { voice: opts.voice, music: opts.music ?? false, concurrency: opts.concurrency ?? defaultConcurrency() },
    usage: null,
  };
  jobs.set(run_id, rec);
  persist(rec);
  queue.push({ rec, plan });
  void pump();
  return rec;
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await runJob(item.rec, item.plan);
      } catch (e) {
        log("job crashed", (e as Error).stack ?? e);
        change(item.rec, { state: "failed", step: "failed", error: (e as Error).message }, true);
      }
    }
  } finally {
    running = false;
  }
}

/** Load from memory or disk. A job found on disk in a running state belongs to a dead server process. */
export function getJobRecord(id: string): JobRecord | null {
  const mem = jobs.get(id);
  if (mem) return mem;
  try {
    const rec: JobRecord = JSON.parse(fs.readFileSync(jobFile(path.join(runsDir(), path.basename(id))), "utf8"));
    if (rec.state !== "done" && rec.state !== "failed") {
      rec.state = "failed";
      rec.error = "the server restarted while this job was running";
    }
    return rec;
  } catch {
    return null;
  }
}

export function waitForChange(id: string, seconds: number): Promise<JobRecord | null> {
  const rec = getJobRecord(id);
  if (!rec || rec.state === "done" || rec.state === "failed") return Promise.resolve(rec);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      bus.off("change", on);
      resolve(getJobRecord(id));
    };
    const on = (changed: string) => changed === id && finish();
    const timer = setTimeout(finish, Math.max(0, seconds) * 1000);
    bus.on("change", on);
  });
}

export function listRuns(limit: number): { id: string; state: string; video: string | null }[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(runsDir()).filter((n) => n.includes("-mcp-"));
  } catch {
    return [];
  }
  return names
    .map((n) => ({ n, t: (() => { try { return fs.statSync(jobFile(path.join(runsDir(), n))).mtimeMs; } catch { return 0; } })() }))
    .filter((x) => x.t > 0)
    .sort((a, b) => b.t - a.t)
    .slice(0, limit)
    .map(({ n }) => {
      const rec = getJobRecord(n);
      const video = path.join(runsDir(), n, "out", "video.mp4");
      return { id: n, state: rec?.state ?? "unknown", video: fs.existsSync(video) ? video : null };
    });
}

export function readReport(runDir: string): Report | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir, "out", "report.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Attach client-reported usage and rewrite both report files. The server never guesses usage. */
export function attachUsage(id: string, usage: Usage): { ok: boolean; message: string } {
  const rec = getJobRecord(id);
  if (!rec) return { ok: false, message: `no run named ${id}` };
  const rep = readReport(rec.run_dir);
  rec.usage = usage;
  try {
    fs.writeFileSync(jobFile(rec.run_dir), JSON.stringify(rec, null, 2));
  } catch {
    // run folder may be gone; fall through
  }
  if (!rep) return { ok: true, message: "usage saved in job.json; the report is not written yet and will include it when it is" };
  rep.usage = usage;
  fs.writeFileSync(path.join(rec.run_dir, "out", "report.json"), JSON.stringify(rep, null, 2));
  fs.writeFileSync(path.join(rec.run_dir, "out", "report.md"), reportMarkdown(rep));
  return { ok: true, message: "usage attached; report.json and report.md rewritten" };
}

// ---------------------------------------------------------------- pipeline

async function runJob(rec: JobRecord, plan: VideoPlan): Promise<void> {
  const t0 = Date.now();
  const dir = rec.run_dir;
  const out = (f: string) => path.join(dir, "out", f);
  const ctx: {
    voice: Report["voice"]; audio: Record<string, number>; timings: ReturnType<typeof layoutScenes>;
    video: Report["video"]; loud: Report["loudness"]; sync: Report["sync"]; musicNote: string | null;
  } = {
    voice: { engine: null, model: null, voice: null, licence_note: null },
    audio: {}, timings: [], video: null, loud: null, musicNote: null,
    sync: { method: "not-measured", reason: "not reached", asr_model: null, wer_overall: null, per_scene: [], caption_pages: 0 },
  };

  const step = async (state: JobState, name: string, fn: () => Promise<void>) => {
    const s = { name, seconds: 0, started_at: Date.now() };
    rec.steps.push(s);
    change(rec, { state, step: name, progress: 0 });
    try {
      await fn();
    } finally {
      s.seconds = round((Date.now() - s.started_at) / 1000, 1);
      persist(rec);
    }
  };

  let failure: string | null = null;
  try {
    await step("voice", "voice", async () => {
      const info = await voiceInfo();
      if (!info.reachable) throw new Error(`VoiceStudio is not reachable: ${info.error}`);
      if (!info.engine) throw new Error(info.error ?? "VoiceStudio reported no active engine");
      ctx.voice = { engine: info.engine, model: info.model ?? null, voice: null, licence_note: info.licence_note ?? null };
      if (!info.allowed) throw new Error(info.licence_note ?? "engine not allowed");
      const def = defaultVoice(info.model ?? "");
      const user = rec.options.voice ?? {};
      const settings: VoiceSettings = { ...def, ...user };
      if (user.voice && user.voice !== def.voice && user.instructions === undefined) delete settings.instructions;
      if (def.language) settings.language = plan.language || def.language;
      ctx.voice.voice = settings.voice ?? null;
      const narrated = plan.scenes.filter((s) => s.narration.trim());
      let n = 0;
      for (const s of narrated) {
        const res = await synthesize(s.narration, settings);
        fs.writeFileSync(path.join(dir, "public", "voice", `${s.id}.wav`), res.wav);
        ctx.audio[s.id] = res.seconds;
        change(rec, { progress: Math.round((++n / narrated.length) * 100) });
      }
    });

    ctx.timings = layoutScenes(plan, ctx.audio);
    const pages = absolutePages(plan, ctx.timings);
    ctx.sync.caption_pages = pages.length;
    fs.writeFileSync(out("captions.srt"), toSrt(pages));

    await step("render", "render", async () => {
      const musicFile = rec.options.music ? stageMusic(path.join(dir, "public")) : null;
      if (rec.options.music && !musicFile) ctx.musicNote = "music requested but no track found; rendered without music";
      const propsPlan: VideoPlan = structuredClone(plan);
      for (const sc of propsPlan.scenes) {
        if (sc.kind === "image" && sc.image) {
          const ext = path.extname(sc.image.path).toLowerCase();
          fs.mkdirSync(path.join(dir, "public", "images"), { recursive: true });
          fs.copyFileSync(sc.image.path, path.join(dir, "public", "images", `${sc.id}${ext}`));
          sc.image.path = `images/${sc.id}${ext}`;
        }
      }
      const props = buildProps({
        plan: propsPlan, timings: ctx.timings, musicFile,
        voiceLabel: [ctx.voice.engine, ctx.voice.model?.split("/").pop()].filter(Boolean).join(" / "),
      });
      const propsPath = path.join(dir, "work", "props.json");
      fs.writeFileSync(propsPath, JSON.stringify(props));
      syncComposition();
      const entry = "src/media-studio-mcp/index.ts";
      const common = [`--props=${propsPath}`, `--public-dir=${path.join(dir, "public")}`];
      const raw = path.join(dir, "work", "raw.mp4");
      const r = await runRemotion(["render", entry, "McpVideo", raw, ...common, `--concurrency=${rec.options.concurrency}`], (d, t) =>
        change(rec, { progress: Math.round((d / t) * 100) }),
      );
      if (r.code !== 0 || !fs.existsSync(raw)) throw new Error(`Remotion render failed (exit ${r.code}): ${r.tail.slice(-800)}`);
      const frame = Math.max(1, Math.round(ctx.timings[0].durationFrames / 2));
      const st = await runRemotion(["still", entry, "McpVideo", out("thumbnail.png"), ...common, `--frame=${frame}`]);
      if (st.code !== 0) log("thumbnail failed", st.tail.slice(-300));
    });

    await step("master", "master", async () => {
      const raw = path.join(dir, "work", "raw.mp4");
      const r = await runNode(mediaScript(), ["master", raw, out("video.mp4"), "--lufs", "-14", "--tp", "-1"]);
      if (r.code !== 0 || !fs.existsSync(out("video.mp4"))) throw new Error(`loudness master failed: ${(r.stderr || r.stdout).slice(-500)}`);
      fs.rmSync(raw, { force: true });
    });

    await step("measure", "measure", async () => {
      const pr = await runNode(mediaScript(), ["probe", out("video.mp4")]);
      if (pr.code !== 0) throw new Error(`probe failed: ${(pr.stderr || pr.stdout).slice(-300)}`);
      const p = JSON.parse(pr.stdout);
      ctx.video = {
        path: out("video.mp4"), size_mb: round(p.sizeBytes / 1048576, 1), width: p.width, height: p.height, fps: p.fps, duration_s: round(p.durationSec, 2),
      };
      if (p.loudness) {
        ctx.loud = {
          integrated_lufs: p.loudness.integratedLufs, true_peak_db: p.loudness.truePeakDb, target_lufs: -14,
          within_1_lu: Math.abs(p.loudness.integratedLufs - -14) <= 1,
        };
      }
      await runNode(mediaScript(), ["sheet", out("video.mp4"), out("contact-sheet.png"), "--every", "2"]);
      if (fs.existsSync(out("contact-sheet.png")) && fs.statSync(out("contact-sheet.png")).size > 900 * 1024) {
        await runNode(mediaScript(), ["sheet", out("video.mp4"), out("contact-sheet.png"), "--every", "2", "--thumb", "240"]);
      }
      await measureSync(plan, dir, ctx.sync);
    });
  } catch (e) {
    failure = (e as Error).message;
  }

  // report + tracing (also written for failed jobs)
  const total = round((Date.now() - t0) / 1000, 1);
  const tracing = await sendTrace(
    rec.run_id,
    { description: plan.description, style: plan.style, length_seconds: plan.length_seconds },
    rec.steps.map((s) => ({ name: s.name, seconds: s.seconds, startedAt: s.started_at })),
    failure ? "failed" : "done",
  );
  const narrationSeconds = Object.values(ctx.audio).reduce((a, b) => a + b, 0);
  const words = plan.scenes.reduce((a, s) => a + wordCount(s.narration), 0);
  const actual = ctx.video?.duration_s;
  const report: Report = {
    run_id: rec.run_id,
    request: {
      description: plan.description, length_seconds: plan.length_seconds, style: plan.style, language: plan.language,
      format: plan.format, audience: plan.audience ?? null,
    },
    rendered: !failure && ctx.video !== null,
    error: failure ?? ctx.musicNote,
    video: ctx.video,
    duration: actual === undefined ? null : {
      requested_s: plan.length_seconds, actual_s: actual, difference_s: round(actual - plan.length_seconds, 2),
      difference_pct: round(((actual - plan.length_seconds) / plan.length_seconds) * 100, 1),
    },
    loudness: ctx.loud,
    voice: ctx.voice,
    sync: ctx.sync,
    script: { author: plan.author, scenes: plan.scenes.length, words, words_per_second: narrationSeconds ? round(words / narrationSeconds, 2) : null },
    sources: plan.sources.map((s) => ({ id: s.id, title: s.title, url: s.url, publisher: s.publisher ?? null })),
    steps: rec.steps.map((s) => ({ name: s.name, seconds: s.seconds })),
    total_seconds: total,
    usage: rec.usage ?? "not reported by the client",
    files: {
      plan: path.join(dir, "brief", "plan.json"), video: out("video.mp4"), captions: out("captions.srt"), thumbnail: out("thumbnail.png"),
      contact_sheet: out("contact-sheet.png"), report_json: out("report.json"), report_md: out("report.md"), job: jobFile(dir),
    },
    tracing,
  };
  fs.writeFileSync(out("report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(out("report.md"), reportMarkdown(report));
  change(rec, failure ? { state: "failed", step: "failed", error: failure } : { state: "done", step: "done", progress: 100 }, true);

}

/** Transcribe each scene WAV with VoiceStudio's speech-to-text and compare with the narration text. */
async function measureSync(plan: VideoPlan, dir: string, sync: Report["sync"]): Promise<void> {
  const asr = await asrInfo();
  if (!asr.available) {
    sync.method = "not-measured";
    sync.reason = asr.reason ?? "no speech-to-text engine available";
    return;
  }
  const refs: string[] = [];
  const hyps: string[] = [];
  try {
    for (const s of plan.scenes.filter((x) => x.narration.trim())) {
      const text = await transcribe(path.join(dir, "public", "voice", `${s.id}.wav`));
      sync.per_scene.push({ scene: s.id, wer: round(wordErrorRate(s.narration, text), 3) });
      refs.push(s.narration);
      hyps.push(text);
    }
    sync.method = "asr";
    sync.reason = null;
    sync.asr_model = asr.model ?? asr.engine ?? null;
    sync.wer_overall = round(wordErrorRate(refs.join(" "), hyps.join(" ")), 3);
  } catch (e) {
    sync.method = "not-measured";
    sync.reason = `transcription failed: ${(e as Error).message}`;
    sync.per_scene = [];
  }
}
