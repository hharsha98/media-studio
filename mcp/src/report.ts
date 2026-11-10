export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  model?: string;
  client?: string;
}

export interface Report {
  run_id: string;
  request: { description: string; length_seconds: number; style: string; language: string; format: string; audience: string | null };
  rendered: boolean;
  error: string | null;
  video: { path: string; size_mb: number; width: number; height: number; fps: number; duration_s: number } | null;
  duration: { requested_s: number; actual_s: number; difference_s: number; difference_pct: number } | null;
  loudness: { integrated_lufs: number; true_peak_db: number; target_lufs: number; within_1_lu: boolean } | null;
  voice: { engine: string | null; model: string | null; voice: string | null; licence_note: string | null };
  sync: {
    method: "asr" | "not-measured";
    reason: string | null;
    asr_model: string | null;
    wer_overall: number | null;
    per_scene: { scene: string; wer: number }[];
    caption_pages: number;
  };
  script: { author: string; scenes: number; words: number; words_per_second: number | null };
  sources: { id: string; title: string; url: string; publisher: string | null }[];
  steps: { name: string; seconds: number }[];
  total_seconds: number;
  usage: Usage | "not reported by the client";
  files: Record<string, string>;
  tracing: string;
}

const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const round = r;

/** Plain table: measured value next to target. No scores, grades or pass/fail gates. */
export function reportMarkdown(rep: Report): string {
  const L: string[] = [];
  const row = (k: string, v: unknown) => L.push(`| ${k} | ${v} |`);
  const table = (title: string, head: [string, string]) => {
    L.push("", `## ${title}`, "", `| ${head[0]} | ${head[1]} |`, "| --- | --- |");
  };
  L.push(`# Run report: ${rep.run_id}`);
  table("Request", ["Field", "Value"]);
  row("description", rep.request.description);
  row("length requested", `${rep.request.length_seconds} s`);
  row("style", rep.request.style);
  row("language", rep.request.language);
  row("format", rep.request.format);
  row("audience", rep.request.audience ?? "not given");
  table("Result", ["Field", "Value"]);
  row("rendered", rep.rendered ? "yes" : `no (${rep.error ?? "unknown error"})`);
  if (rep.video) {
    row("video", rep.video.path);
    row("size", `${rep.video.size_mb} MB`);
    row("resolution", `${rep.video.width}x${rep.video.height}`);
    row("fps", rep.video.fps);
    row("duration", `${rep.video.duration_s} s`);
  }
  L.push("", "## Measured against target", "", "| Measure | Measured | Target |", "| --- | --- | --- |");
  const row3 = (k: string, a: unknown, b: unknown) => L.push(`| ${k} | ${a} | ${b} |`);
  if (rep.duration) {
    row3("duration", `${rep.duration.actual_s} s (difference ${rep.duration.difference_s} s, ${rep.duration.difference_pct}%)`, `${rep.duration.requested_s} s`);
  }
  if (rep.loudness) {
    row3("integrated loudness", `${rep.loudness.integrated_lufs} LUFS (within 1 LU of target: ${rep.loudness.within_1_lu ? "yes" : "no"})`, `${rep.loudness.target_lufs} LUFS`);
    row3("true peak", `${rep.loudness.true_peak_db} dBTP`, "-1 dBTP");
  }
  if (rep.sync.method === "asr") {
    row3("voice vs caption text (WER)", rep.sync.wer_overall, `0 (speech-to-text: ${rep.sync.asr_model ?? "active engine"})`);
    for (const s of rep.sync.per_scene) row3(`WER scene ${s.scene}`, s.wer, "0");
  } else {
    row3("voice vs caption text (WER)", `not measured (${rep.sync.reason ?? "no reason given"})`, "0");
  }
  row3("caption pages", rep.sync.caption_pages, "n/a");
  table("Voice", ["Field", "Value"]);
  row("engine", rep.voice.engine ?? "unknown");
  row("model", rep.voice.model ?? "unknown");
  row("voice", rep.voice.voice ?? "unknown");
  row("licence note", rep.voice.licence_note ?? "none");
  table("Script", ["Field", "Value"]);
  row("author", rep.script.author);
  row("scenes", rep.script.scenes);
  row("words", rep.script.words);
  row("words per second (spoken)", rep.script.words_per_second ?? "not measured");
  table("Steps", ["Step", "Seconds"]);
  for (const s of rep.steps) row(s.name, s.seconds);
  row("total", rep.total_seconds);
  table("Usage", ["Field", "Value"]);
  if (rep.usage === "not reported by the client") row("usage", rep.usage);
  else {
    row("client", rep.usage.client ?? "not given");
    row("model", rep.usage.model ?? "not given");
    row("input tokens", rep.usage.input_tokens ?? "not given");
    row("output tokens", rep.usage.output_tokens ?? "not given");
    row("cost (USD)", rep.usage.cost_usd ?? "not given");
  }
  L.push("", "## Sources", "");
  if (rep.sources.length === 0) L.push("none");
  for (const s of rep.sources) L.push(`- ${s.id}: ${s.title} (${s.publisher ?? "n/a"}) ${s.url}`);
  table("Files", ["File", "Path"]);
  for (const [k, v] of Object.entries(rep.files)) row(k, v);
  table("Tracing", ["Field", "Value"]);
  row("langfuse", rep.tracing);
  return L.join("\n") + "\n";
}
