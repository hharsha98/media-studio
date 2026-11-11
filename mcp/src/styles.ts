export interface Theme {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  font: string;
}

export interface Motion {
  /** spring damping: lower = bouncier */
  damping: number;
  /** frames for the in/out transition of each scene */
  transitionFrames: number;
  transition: "fade" | "slide" | "zoom";
  /** how far elements travel when entering, in px */
  travel: number;
  /** seconds between staggered items */
  stagger: number;
}

export interface StylePreset {
  id: string;
  summary: string;
  theme: Theme;
  motion: Motion;
  /** silence before the narration starts and after it ends, in seconds */
  leadSeconds: number;
  tailSeconds: number;
}

const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

export const STYLE_IDS = ["explainer", "teaser", "data-story", "pitch", "tutorial", "news", "custom"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLES: Record<StyleId, StylePreset> = {
  explainer: {
    id: "explainer",
    summary: "Calm and light. Soft motion, generous spacing, easy to follow.",
    theme: { background: "#F6F7FB", foreground: "#14213D", accent: "#2563EB", muted: "#5B6478", font: FONT },
    motion: { damping: 18, transitionFrames: 12, transition: "fade", travel: 36, stagger: 0.28 },
    leadSeconds: 0.35,
    tailSeconds: 0.45,
  },
  teaser: {
    id: "teaser",
    summary: "Bold and dark. Fast cuts, big type, punchy motion.",
    theme: { background: "#0B0B12", foreground: "#FFFFFF", accent: "#FF4D6D", muted: "#A3A3B8", font: FONT },
    motion: { damping: 12, transitionFrames: 10, transition: "zoom", travel: 70, stagger: 0.16 },
    leadSeconds: 0.25,
    tailSeconds: 0.3,
  },
  "data-story": {
    id: "data-story",
    summary: "Chart-forward. Clean dark canvas, numbers and bars lead.",
    theme: { background: "#0F172A", foreground: "#F1F5F9", accent: "#22D3EE", muted: "#94A3B8", font: FONT },
    motion: { damping: 20, transitionFrames: 12, transition: "slide", travel: 48, stagger: 0.22 },
    leadSeconds: 0.35,
    tailSeconds: 0.5,
  },
  pitch: {
    id: "pitch",
    summary: "Confident. The accent colour is used strongly; set your own colours in theme.",
    theme: { background: "#111827", foreground: "#F9FAFB", accent: "#F59E0B", muted: "#9CA3AF", font: FONT },
    motion: { damping: 14, transitionFrames: 12, transition: "slide", travel: 56, stagger: 0.22 },
    leadSeconds: 0.3,
    tailSeconds: 0.4,
  },
  tutorial: {
    id: "tutorial",
    summary: "Numbered steps, steady pace, clear contrast.",
    theme: { background: "#FFFFFF", foreground: "#1F2937", accent: "#059669", muted: "#6B7280", font: FONT },
    motion: { damping: 18, transitionFrames: 12, transition: "slide", travel: 40, stagger: 0.3 },
    leadSeconds: 0.35,
    tailSeconds: 0.5,
  },
  news: {
    id: "news",
    summary: "Sober. Restrained motion, serious palette, no flourish.",
    theme: { background: "#1C1F26", foreground: "#EDEFF2", accent: "#E5484D", muted: "#9AA1AD", font: FONT },
    motion: { damping: 28, transitionFrames: 10, transition: "fade", travel: 20, stagger: 0.2 },
    leadSeconds: 0.35,
    tailSeconds: 0.45,
  },
  custom: {
    id: "custom",
    summary: "Neutral base. Supply every colour in theme.",
    theme: { background: "#F3F4F6", foreground: "#111827", accent: "#4F46E5", muted: "#6B7280", font: FONT },
    motion: { damping: 18, transitionFrames: 12, transition: "fade", travel: 36, stagger: 0.25 },
    leadSeconds: 0.35,
    tailSeconds: 0.45,
  },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Style preset + the plan's own theme overrides (invalid hex colours are ignored). */
export function resolveTheme(style: StyleId, override?: Partial<Theme>): Theme {
  const base = { ...STYLES[style].theme };
  if (!override) return base;
  for (const k of ["background", "foreground", "accent", "muted"] as const) {
    const v = override[k];
    if (v && HEX.test(v)) base[k] = v;
  }
  if (override.font && /^[\w\s",.'-]{2,120}$/.test(override.font)) base.font = override.font;
  return base;
}
