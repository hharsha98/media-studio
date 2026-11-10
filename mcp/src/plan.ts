import { z } from "zod";
import { STYLE_IDS } from "./styles.js";

export const SCENE_KINDS = ["title", "bullets", "stat", "quote", "steps", "compare", "chart", "image", "end"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

const hex = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, "use a hex colour like #2563EB");
const side = z.object({ heading: z.string(), items: z.array(z.string()) });

export const SceneSchema = z.object({
  id: z.string().min(1).describe("unique, e.g. sc1"),
  kind: z.enum(SCENE_KINDS),
  narration: z.string().describe("Spoken text AND caption text. May be empty only for the end scene."),
  heading: z.string().optional(),
  subtitle: z.string().optional().describe("title scenes"),
  items: z.array(z.string()).optional().describe("bullets/steps: up to 5 items, up to 60 characters each"),
  value: z.string().optional().describe("stat scenes: the big number, e.g. '42%'"),
  label: z.string().optional().describe("stat scenes: what the number means"),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  left: side.optional().describe("compare scenes"),
  right: side.optional().describe("compare scenes"),
  chart: z
    .object({ unit: z.string().optional(), bars: z.array(z.object({ label: z.string(), value: z.number() })) })
    .optional()
    .describe("chart scenes: up to 6 bars"),
  image: z
    .object({ path: z.string().describe("absolute local .png/.jpg path"), credit: z.string() })
    .optional()
    .describe("image scenes"),
  source_ids: z.array(z.string()).optional().describe("required for stat and chart scenes"),
});

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  url: z.string(),
  publisher: z.string().optional(),
});

export const VideoPlanSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  audience: z.string().optional(),
  style: z.enum(STYLE_IDS),
  language: z.string().default("en"),
  length_seconds: z.number().min(10).max(120),
  format: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  theme: z
    .object({
      background: hex.optional(),
      foreground: hex.optional(),
      accent: hex.optional(),
      muted: hex.optional(),
      font: z.string().optional(),
    })
    .optional(),
  author: z.enum(["agent", "server-fallback"]),
  sources: z.array(SourceSchema).default([]),
  scenes: z.array(SceneSchema),
});

export type Scene = z.infer<typeof SceneSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type VideoPlan = z.infer<typeof VideoPlanSchema>;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  estimated_seconds: number;
}

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export function estimateSceneSeconds(s: Pick<Scene, "kind" | "narration">): number {
  const words = wordCount(s.narration);
  if (s.kind === "end") return words ? Math.max(3.5, words / 2.8 + 0.8) : 3.5;
  const t = words / 2.8 + 0.8;
  return s.kind === "title" ? Math.max(2.5, t) : t;
}

export function estimateSeconds(scenes: Pick<Scene, "kind" | "narration">[]): number {
  let t = scenes.reduce((a, s) => a + estimateSceneSeconds(s), 0);
  if (!scenes.some((s) => s.kind === "end")) t += 3.5;
  return Math.round(t * 10) / 10;
}

const URL_OR_EMAIL = /(https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.[\w.]+)/i;

/** Pure check of a plan. Never throws. */
export function validatePlan(input: unknown): ValidationResult {
  const parsed = VideoPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`),
      warnings: [],
      estimated_seconds: 0,
    };
  }
  const plan = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceIds = new Set(plan.sources.map((s) => s.id));
  // the server's own fallback shows whole sentences; agent plans keep on-screen text short
  const maxItem = plan.author === "server-fallback" ? 200 : 60;
  const content = plan.scenes.filter((s) => s.kind !== "end");

  if (plan.scenes.length < 2 || plan.scenes.length > 12) errors.push(`scenes: need 2 to 12 scenes, got ${plan.scenes.length}`);
  const seen = new Set<string>();
  for (const s of plan.scenes) {
    const at = `scene ${s.id}`;
    if (seen.has(s.id)) errors.push(`${at}: duplicate scene id`);
    seen.add(s.id);
    if (!/^[\w-]+$/.test(s.id)) errors.push(`${at}: id may only contain letters, digits, _ and -`);
    if (s.narration.length > 600) errors.push(`${at}: narration is ${s.narration.length} characters (max 600)`);
    if (s.kind !== "end" && !s.narration.trim()) errors.push(`${at}: narration is empty (only the end scene may be silent)`);
    for (const [field, text] of [["narration", s.narration], ["heading", s.heading ?? ""], ["subtitle", s.subtitle ?? ""]] as const) {
      if (URL_OR_EMAIL.test(text)) warnings.push(`${at}: ${field} contains a URL or email address (it would be spoken aloud)`);
    }
    const items = s.items ?? [];
    if (items.length > 5) errors.push(`${at}: at most 5 items, got ${items.length}`);
    for (const it of items) if (it.length > maxItem) errors.push(`${at}: item longer than ${maxItem} characters: "${it.slice(0, 30)}..."`);

    switch (s.kind) {
      case "title":
        if (!s.heading) errors.push(`${at}: title needs heading`);
        break;
      case "bullets":
      case "steps":
        if (!s.heading && s.kind === "bullets") errors.push(`${at}: bullets needs heading`);
        if (items.length < 1) errors.push(`${at}: ${s.kind} needs items`);
        break;
      case "stat":
        if (!s.value) errors.push(`${at}: stat needs value`);
        if (!s.label) errors.push(`${at}: stat needs label`);
        break;
      case "quote":
        if (!s.quote) errors.push(`${at}: quote needs quote text`);
        break;
      case "compare":
        if (!s.left || !s.right) errors.push(`${at}: compare needs left and right`);
        for (const sd of [s.left, s.right]) {
          if (!sd) continue;
          if (sd.items.length > 5) errors.push(`${at}: compare sides take at most 5 items`);
          for (const it of sd.items) if (it.length > 60) errors.push(`${at}: compare item longer than 60 characters`);
        }
        break;
      case "chart":
        if (!s.chart || s.chart.bars.length < 1) errors.push(`${at}: chart needs bars`);
        else if (s.chart.bars.length > 6) errors.push(`${at}: chart takes at most 6 bars`);
        break;
      case "image":
        if (!s.image?.path) errors.push(`${at}: image needs image.path`);
        else if (!/\.(png|jpe?g)$/i.test(s.image.path)) errors.push(`${at}: image must be a .png or .jpg file`);
        else if (!/^(\/|[A-Za-z]:[\\/])/.test(s.image.path)) errors.push(`${at}: image path must be absolute`);
        else if (!fileExists(s.image.path)) errors.push(`${at}: image file not found: ${s.image.path}`);
        if (s.image && !s.image.credit) errors.push(`${at}: image needs a credit`);
        break;
      case "end":
        break;
    }
    if (s.kind === "stat" || s.kind === "chart") {
      if (!s.source_ids?.length) errors.push(`${at}: ${s.kind} must cite source_ids (every number needs a source)`);
    }
    for (const id of s.source_ids ?? []) if (!sourceIds.has(id)) errors.push(`${at}: unknown source id "${id}"`);
  }

  if (plan.scenes[0] && plan.scenes[0].kind !== "title") warnings.push("first scene is not a title scene");
  if (content.length === 0) errors.push("scenes: no content scenes");
  const est = estimateSeconds(plan.scenes);
  if (Math.abs(est - plan.length_seconds) / plan.length_seconds > 0.25) {
    warnings.push(`estimated length ${est}s is more than 25% away from the requested ${plan.length_seconds}s (about 2.8 spoken words per second)`);
  }
  return { ok: errors.length === 0, errors, warnings, estimated_seconds: est };
}

import fs from "node:fs";
function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Append an end scene (sources + labels are drawn by the composition) when the plan has none. */
export function withEndScene(plan: VideoPlan): VideoPlan {
  if (plan.scenes.some((s) => s.kind === "end")) return plan;
  return { ...plan, scenes: [...plan.scenes, { id: "end", kind: "end", narration: "" }] };
}
