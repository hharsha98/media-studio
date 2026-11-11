import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface Theme { background: string; foreground: string; accent: string; muted: string; font: string }
export interface Motion { damping: number; transitionFrames: number; transition: "fade" | "slide" | "zoom"; travel: number; stagger: number }
export interface CaptionPage { lines: string[]; from: number; to: number }
export interface SceneData {
  id: string;
  kind: "title" | "bullets" | "stat" | "quote" | "steps" | "compare" | "chart" | "image" | "end";
  narration: string;
  heading?: string;
  subtitle?: string;
  items?: string[];
  value?: string;
  label?: string;
  quote?: string;
  attribution?: string;
  left?: { heading: string; items: string[] };
  right?: { heading: string; items: string[] };
  chart?: { unit?: string; bars: { label: string; value: number }[] };
  image?: { path: string; credit: string };
  durationFrames: number;
  leadFrames: number;
  audio: string | null;
  sourceTag: string | null;
  captions: CaptionPage[];
}
export type VideoProps = {
  format: "16:9" | "9:16" | "1:1";
  width: number;
  height: number;
  fps: number;
  theme: Theme;
  motion: Motion;
  labels: { aiVoice: boolean; narration: string | null; music: string | null; madeWith: string };
  music: { src: string; volume: number } | null;
  sources: { publisher: string; title: string }[];
  scenes: SceneData[];
};

/** Layout numbers shared by all scenes (design is done for a 1080 px short side). */
export interface Box { w: number; h: number; vertical: boolean; pad: number; bottom: number; cw: number; ch: number }

export function rgba(hex: string, a: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Largest font size (px) at which `text` fits a box of w x h when wrapped. Estimates glyph width at 0.56 em. */
export function fitSize(text: string, w: number, h: number, max: number, min = 22, lineHeight = 1.2): number {
  const len = Math.max(text.length, 1);
  for (let s = max; s > min; s -= 2) {
    const perLine = Math.max(1, Math.floor(w / (0.56 * s)));
    const lines = Math.ceil((len * 1.12) / perLine);
    if (lines * lineHeight * s <= h) return s;
  }
  return min;
}

/** 0 -> 1 spring that starts `delay` frames into the scene. */
export function useEnter(delay: number, damping: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 }, durationInFrames: 28 });
}

export const domainOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
