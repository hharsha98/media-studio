import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mediaScript, msHome, remotionTarget, runsDir, videoProject, voiceStudioUrl } from "./config.js";
import { draftPlan } from "./draft.js";
import { styleGuide } from "./guide.js";
import { attachUsage, listRuns, readReport, submitJob, waitForChange } from "./jobs.js";
import { VideoPlanSchema, validatePlan } from "./plan.js";
import { runNode } from "./render.js";
import { researchTopic } from "./research.js";
import { STYLE_IDS } from "./styles.js";
import { tracingConfigured } from "./tracing.js";
import { asrInfo, voiceInfo } from "./voice.js";

export const SERVER_NAME = "media-studio-mcp";
export const SERVER_VERSION = "0.2.0";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (o: unknown) => text(JSON.stringify(o, null, 2));
const fail = (t: string) => ({ ...text(t), isError: true });

const factSchema = z.object({ text: z.string(), source_id: z.string() });
const sourceSchema = z.object({ id: z.string(), title: z.string(), url: z.string(), publisher: z.string().optional() });

/** Builds a fresh server with every tool and the prompt. Stdio uses one; HTTP mode makes one per request. */
export function createServer(): McpServer {
const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  "check_setup",
  { description: "Check that everything needed to render is ready: Node, the Remotion video project, media.mjs, ffmpeg, VoiceStudio (engine, licence, speech-to-text), free disk. Call this first." },
  async () => {
    const out: Record<string, unknown> = {};
    out.node = { version: process.versions.node, ok: Number(process.versions.node.split(".")[0]) >= 20 };
    const rpkg = path.join(videoProject(), "node_modules", "remotion", "package.json");
    let remotion: string | null = null;
    try {
      remotion = JSON.parse(fs.readFileSync(rpkg, "utf8")).version;
    } catch {
      // not installed
    }
    out.video_project = { path: videoProject(), found: fs.existsSync(videoProject()), remotion_version: remotion, hint: remotion ? undefined : "run /media-studio:setup to create the Remotion project" };
    const mediaFound = fs.existsSync(mediaScript());
    out.media_mjs = { path: mediaScript(), found: mediaFound, hint: mediaFound ? undefined : "set MEDIA_STUDIO_SCRIPTS to the folder that contains media.mjs" };
    let ffmpeg: unknown = { ok: false, reason: "media.mjs not found" };
    if (mediaFound) {
      const r = await runNode(mediaScript(), ["ffmpeg", "-version"]);
      ffmpeg = { ok: r.code === 0, version: r.stdout.split("\n")[0] || undefined, reason: r.code === 0 ? undefined : (r.stderr || r.stdout).slice(0, 200) };
    }
    out.ffmpeg = ffmpeg;
    const v = await voiceInfo();
    out.voicestudio = { url: voiceStudioUrl(), ...v };
    out.asr = await asrInfo();
    let freeGb: number | null = null;
    try {
      const s = fs.statfsSync(fs.existsSync(msHome()) ? msHome() : "/");
      freeGb = Math.round((Number(s.bavail) * Number(s.bsize)) / 1e8) / 10;
    } catch {
      // statfs unavailable
    }
    out.disk = { free_gb: freeGb };
    out.runs_folder = { path: runsDir(), exists: fs.existsSync(runsDir()) };
    out.composition_target = remotionTarget();
    out.tracing = tracingConfigured() ? "configured (Langfuse)" : "not configured (optional)";
    const ready = Boolean(remotion) && mediaFound && (ffmpeg as any).ok && v.reachable && v.allowed === true;
    out.ready_to_render = ready;
    return json(out);
  },
);

server.registerTool(
  "research_topic",
  {
    description:
      "Fallback research from Wikipedia: returns opening-sentence facts and sources in plan format. Prefer your own web research from reputable sources and pass those sources into the plan; use this only when you have no web tools.",
    inputSchema: { topic: z.string(), language: z.string().default("en"), max_sources: z.number().int().min(1).max(6).default(4) },
  },
  async ({ topic, language, max_sources }) => {
    try {
      return json(await researchTopic(topic, language, max_sources));
    } catch (e) {
      return fail(`research failed: ${(e as Error).message}`);
    }
  },
);

server.registerTool(
  "get_style_guide",
  { description: "Style presets, scene kinds with their fields, a complete example plan and the writing rules. Read before writing a plan.", inputSchema: { style: z.enum(STYLE_IDS).optional() } },
  async ({ style }) => json(styleGuide(style)),
);

server.registerTool(
  "draft_plan",
  {
    description: "Deterministic fallback plan builder (author 'server-fallback'): a title, 2 to 5 fact scenes and an end card sized to the length. Prefer writing your own plan.",
    inputSchema: {
      description: z.string(), length_seconds: z.number().min(10).max(120), style: z.enum(STYLE_IDS).optional(),
      language: z.string().optional(), audience: z.string().optional(), facts: z.array(factSchema).optional(), sources: z.array(sourceSchema).optional(),
    },
  },
  async (args) => {
    try {
      const plan = draftPlan(args);
      return json({ plan, validation: validatePlan(plan) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
);

server.registerTool(
  "validate_plan",
  { description: "Check a video plan without rendering. Returns ok, errors, warnings and the estimated length in seconds.", inputSchema: { plan: VideoPlanSchema } },
  async ({ plan }) => json(validatePlan(plan)),
);

server.registerTool(
  "render_video",
  {
    description: "Validate a plan and queue a render (one at a time). Returns at once with a job_id; poll get_job. Voice comes from the local VoiceStudio app.",
    inputSchema: {
      plan: VideoPlanSchema,
      voice: z.object({ voice: z.string().optional(), instructions: z.string().optional(), speed: z.number().optional() }).optional(),
      music: z.boolean().default(false),
      concurrency: z.number().int().min(1).max(16).optional(),
    },
  },
  async ({ plan, voice, music, concurrency }) => {
    const v = validatePlan(plan);
    if (!v.ok) return { ...json({ queued: false, ...v }), isError: true };
    const rec = submitJob(plan, { voice, music, concurrency });
    return json({ job_id: rec.job_id, run_dir: rec.run_dir, estimated_processing_seconds: rec.estimated_processing_seconds, warnings: v.warnings });
  },
);

server.registerTool(
  "get_job",
  {
    description: "Status of a render job. Long-polls: waits up to wait_seconds (max 50) and returns early when the step changes or the job finishes. When done, includes the report and the contact sheet image.",
    inputSchema: { job_id: z.string(), wait_seconds: z.number().min(0).max(50).default(30) },
  },
  async ({ job_id, wait_seconds }) => {
    const rec = await waitForChange(job_id, wait_seconds);
    if (!rec) return fail(`no job named ${job_id}`);
    const summary: Record<string, unknown> = {
      job_id: rec.job_id, state: rec.state, step: rec.step, progress_percent: rec.progress,
      step_timings: rec.steps.map((s) => ({ name: s.name, seconds: s.started_at && !s.seconds ? Math.round((Date.now() - s.started_at) / 100) / 10 : s.seconds })),
      error: rec.error, run_dir: rec.run_dir,
    };
    const content: any[] = [];
    if (rec.state === "done" || rec.state === "failed") {
      const rep = readReport(rec.run_dir);
      const md = path.join(rec.run_dir, "out", "report.md");
      if (rec.state === "done") summary.video_path = path.join(rec.run_dir, "out", "video.mp4");
      if (rep && fs.existsSync(md)) summary.report_md = fs.readFileSync(md, "utf8");
      content.push({ type: "text", text: JSON.stringify(summary, null, 2) });
      const sheet = path.join(rec.run_dir, "out", "contact-sheet.png");
      if (rec.state === "done" && fs.existsSync(sheet)) content.push({ type: "image", data: fs.readFileSync(sheet).toString("base64"), mimeType: "image/png" });
      return { content, ...(rec.state === "failed" ? { isError: true } : {}) };
    }
    return json(summary);
  },
);

server.registerTool(
  "report_usage",
  {
    description: "Attach token and cost usage that YOUR client reports to a run's report. The server never guesses usage.",
    inputSchema: {
      job_id: z.string().optional(), run_id: z.string().optional(), input_tokens: z.number().optional(), output_tokens: z.number().optional(),
      cost_usd: z.number().optional(), model: z.string().optional(), client: z.string().optional(),
    },
  },
  async ({ job_id, run_id, ...usage }) => {
    const id = job_id ?? run_id;
    if (!id) return fail("give job_id or run_id");
    const r = attachUsage(id, usage);
    return r.ok ? text(r.message) : fail(r.message);
  },
);

server.registerTool(
  "list_runs",
  { description: "Recent runs from disk (id, state, video path).", inputSchema: { limit: z.number().int().min(1).max(100).default(10) } },
  async ({ limit }) => json(listRuns(limit)),
);

server.registerPrompt(
  "make_video",
  {
    description: "Step-by-step instructions for making a short video from a plain description.",
    argsSchema: {
      description: z.string(), length_seconds: z.string().optional(), style: z.string().optional(), language: z.string().optional(), audience: z.string().optional(),
    },
  },
  ({ description, length_seconds, style, language, audience }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Make a short video: ${description}
Length: ${length_seconds ?? "30"} seconds. Style: ${style ?? "explainer"}. Language: ${language ?? "en"}. Audience: ${audience ?? "general"}.

Follow these steps in order:
1. Call check_setup. If ready_to_render is false, tell the user what is missing and stop.
2. Research the topic with YOUR OWN web tools: find 3 to 6 reputable sources and note real facts. If you have no web tools, call research_topic instead.
3. Call get_style_guide and read the scene kinds and writing rules.
4. Write the plan yourself (author "agent"): real facts only, about 2.8 spoken words per second, sources listed in plan.sources, every number cited with source_ids.
5. Call validate_plan and fix every error until ok is true. Read the warnings.
6. Call render_video with the plan. It returns a job_id at once.
7. Call get_job with wait_seconds 45 again and again until state is done or failed. Tell the user the step you are on.
8. If your client reports token or cost usage, call report_usage with the job_id.
9. Show the user the video path, the contact sheet and the report.`,
        },
      },
    ],
  }),
);

return server;
}

