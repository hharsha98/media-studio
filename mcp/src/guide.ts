import { SCENE_KINDS } from "./plan.js";
import { STYLES } from "./styles.js";

export const WRITING_RULES = [
  "Speak about 2.8 words per second: a 30 s video carries roughly 65 to 75 narrated words plus the title and end card.",
  "Captions are the narration text: at most 2 lines of about 42 characters, so write in short sentences.",
  "Every number shown in a stat or chart scene must cite a source (source_ids) and must come from that source.",
  "Do not invent numbers, users, customers or quotes. Real, checkable facts only.",
  "Do not put URLs or email addresses in narration or headings: they would be read aloud.",
  "Start with a title scene; end with an end scene (the server adds one if you leave it out).",
  "Keep on-screen text short: bullets and steps at most 5 items of at most 60 characters.",
  "Use 3 to 8 scenes for 20 to 60 seconds. One idea per scene.",
];

export const SCENE_GUIDE: Record<(typeof SCENE_KINDS)[number], string> = {
  title: "heading (required), subtitle?; opening card with the video title.",
  bullets: "heading (required), items[] (1 to 5, up to 60 chars each).",
  stat: "value (the big number, e.g. '42%'), label (what it means), source_ids (required).",
  quote: "quote (required), attribution? (only a real, sourced quote).",
  steps: "heading?, items[] (1 to 5), shown as numbered steps.",
  compare: "heading?, left {heading, items[]} and right {heading, items[]}.",
  chart: "heading?, chart {unit?, bars:[{label, value}]} (up to 6 bars), source_ids (required).",
  image: "image {path (absolute local .png/.jpg), credit}, heading?.",
  end: "closing card; narration may be empty. Sources and labels are drawn automatically.",
};

/** An illustration of the format only. Replace every word of it with your own researched content. */
export const EXAMPLE_PLAN = {
  title: "How tides work",
  description: "A 20-second explainer on why ocean tides rise and fall",
  audience: "curious beginners",
  style: "explainer",
  language: "en",
  length_seconds: 20,
  format: "16:9",
  author: "agent",
  sources: [{ id: "s1", title: "Tide", url: "https://en.wikipedia.org/wiki/Tide", publisher: "Wikipedia" }],
  scenes: [
    { id: "sc1", kind: "title", heading: "How tides work", subtitle: "The Moon, the Sun and the sea", narration: "Why does the sea rise and fall every day?" },
    {
      id: "sc2", kind: "steps", heading: "Three steps", items: ["The Moon pulls on the ocean", "Water bulges toward it", "Earth turns through the bulges"],
      narration: "The Moon's gravity pulls on the ocean. Water bulges toward it, and Earth rotates through those bulges, so most coasts see high and low tide.",
      source_ids: ["s1"],
    },
    {
      id: "sc3", kind: "compare", heading: "Spring and neap tides",
      left: { heading: "Spring tides", items: ["Sun, Moon and Earth line up", "Biggest tidal range"] },
      right: { heading: "Neap tides", items: ["Sun and Moon at right angles", "Smallest tidal range"] },
      narration: "When the Sun and Moon line up, tides are strongest. When they sit at right angles, tides are weaker.",
      source_ids: ["s1"],
    },
    { id: "sc4", kind: "end", narration: "" },
  ],
};

export function styleGuide(style?: string) {
  const presets = Object.values(STYLES)
    .filter((s) => !style || s.id === style)
    .map((s) => ({ id: s.id, summary: s.summary, theme: s.theme, motion: s.motion }));
  return {
    presets,
    scene_kinds: SCENE_GUIDE,
    plan_fields: {
      required: ["title", "description", "style", "length_seconds", "author ('agent' when you wrote it)", "scenes"],
      optional: ["audience", "language (default en)", "format (16:9 | 9:16 | 1:1, default 16:9)", "theme {background, foreground, accent, muted, font} hex colours override the style", "sources [{id, title, url, publisher?}]"],
    },
    writing_rules: WRITING_RULES,
    example_plan: EXAMPLE_PLAN,
  };
}
