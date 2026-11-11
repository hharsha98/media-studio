import type { Scene, Source, VideoPlan } from "./plan.js";
import type { Fact } from "./research.js";
import type { StyleId } from "./styles.js";

export interface DraftInput {
  description: string;
  length_seconds: number;
  style?: StyleId;
  language?: string;
  audience?: string;
  facts?: Fact[];
  sources?: Source[];
}

const WPS = 2.8;
const MAX_WORDS = 28;
const MAX_CHARS = 190;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** "A 20-second explainer on how a heat pump heats a home" -> "How a heat pump heats a home". */
export function cleanTitle(description: string): string {
  let t = description.trim().replace(/[.!?]+$/, "");
  t = t.replace(
    /^(?:an?\s+)?(?:\d+\s*-?\s*(?:seconds?|secs?|minutes?|mins?)\s*-?\s*)?(?:(?:short|quick|brief|animated|explainer|teaser|tutorial|pitch|news|data[- ]story)\s+)*(?:video\s+)?(?:(?:on|about|explaining|of|showing|that explains|that shows)\s+)?/i,
    "",
  );
  t = t.trim() || description.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface Sentence { text: string; source_id: string; words: number }

/** Whole sentences only; parentheses (pronunciations, dates) are dropped; mostly-parenthetical sentences are skipped. */
export function wholeSentences(text: string, source_id: string): Sentence[] {
  const out: Sentence[] = [];
  for (const raw of text.replace(/\s+/g, " ").match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []) {
    const original = raw.trim();
    const stripped = original.replace(/\s*\([^)]*\)/g, "").replace(/\s+([,.;:!?])/g, "$1").trim();
    if (!/[.!?]$/.test(stripped)) continue; // cut mid-sentence: never use
    if (stripped.length < original.length * 0.6) continue;
    const n = words(stripped).length;
    if (n < 5) continue;
    out.push({ text: stripped, source_id, words: n });
  }
  return out;
}

/** Deterministic fallback plan: clean title, one scene per source made of whole sentences, end card. */
export function draftPlan(input: DraftInput): VideoPlan {
  const style = input.style ?? "explainer";
  const L = input.length_seconds;
  const title = cleanTitle(input.description);
  const titleNarration = /[.!?]$/.test(title) ? title : `${title}.`;
  const body = Math.max(L - 3.5 - 3.5, 6);
  const target = Math.min(5, Math.max(2, Math.round(body / 8)));
  const budget = Math.max(8, (body / target - 0.8) * WPS);

  const facts = input.facts?.filter((f) => f.text.trim()) ?? [];
  // never turn the request itself into a "fact": that would read the request aloud
  if (facts.length === 0) throw new Error("draft_plan needs facts: call research_topic first (or let the agent write the plan).");
  const titleOf = new Map((input.sources ?? []).map((s) => [s.id, s.title]));
  const pools: { id: string; sentences: Sentence[] }[] = [];
  for (const f of facts) {
    let p = pools.find((x) => x.id === f.source_id);
    if (!p) pools.push((p = { id: f.source_id, sentences: [] }));
    p.sentences.push(...wholeSentences(f.text, f.source_id));
  }
  const fallbackHeads = ["The basics", "How it works", "Why it matters", "In practice", "Worth knowing"];
  const scenes: Scene[] = [];
  // one scene per source first, then further rounds if the length needs more scenes
  for (let round = 0; round < 5 && scenes.length < target; round++) {
    for (const pool of pools) {
      if (scenes.length >= target || !pool.sentences.length) continue;
      {
      // strict: only short whole sentences (the validator caps items at 200 characters); a source without any is skipped
      const cand = pool.sentences.filter((s) => s.words <= MAX_WORDS && s.text.length <= MAX_CHARS);
      if (!cand.length) { pool.sentences = []; continue; }
      // closest to the budget, from those that fit; else the shortest
      const fit = cand.filter((s) => s.words <= budget * 1.15);
      const first = fit.length
        ? fit.reduce((a, b) => (Math.abs(b.words - budget) < Math.abs(a.words - budget) ? b : a))
        : cand.reduce((a, b) => (b.words < a.words ? b : a));
      const chosen = [first];
      const second = cand.find((s) => s !== first && first.words + s.words <= budget * 1.35);
      if (second) chosen.push(second);
      pool.sentences = pool.sentences.filter((s) => !chosen.includes(s));
      const sid = pool.id;
      scenes.push({
        id: `sc${scenes.length + 1}`,
        kind: "bullets",
        heading: (sid && titleOf.get(sid)) || fallbackHeads[scenes.length % fallbackHeads.length],
        items: chosen.map((s) => s.text),
        narration: chosen.map((s) => s.text).join(" "),
        source_ids: sid ? [sid] : [],
      });
      }
    }
  }
  if (scenes.length === 0) {
    throw new Error(`draft_plan found no whole sentence of ${MAX_WORDS} words or fewer in the facts. Pass shorter facts, or let the agent write the plan.`);
  }
  return {
    title,
    description: input.description,
    audience: input.audience,
    style,
    language: input.language ?? "en",
    length_seconds: L,
    format: "16:9",
    author: "server-fallback",
    sources: input.sources ?? [],
    scenes: [
      { id: "sc0", kind: "title", heading: title, subtitle: input.audience ? `For ${input.audience}` : undefined, narration: titleNarration },
      ...scenes,
      { id: "end", kind: "end", narration: "" },
    ],
  };
}
