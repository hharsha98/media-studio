export const MAX_LINE = 42;

export interface CaptionPage {
  lines: string[];
  /** seconds, relative to the start of the narration audio */
  start: number;
  end: number;
}

const WEAK = new Set(
  "a an the of to in on at by for with and or but from as its their his her my your our each per than that which who if into so is are no own".split(" "),
);
const endsWeak = (s: string) => WEAK.has((s.split(" ").pop() ?? "").toLowerCase().replace(/[.,:;!?]/g, ""));

/** Split words into at most two lines of <= MAX_LINE chars, balanced, avoiding a line ending on a weak word. */
export function wrapTwo(words: string[]): string[] | null {
  const full = words.join(" ");
  if (full.length <= MAX_LINE) return [full];
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    if (a.length > MAX_LINE || b.length > MAX_LINE) continue;
    const score = Math.abs(a.length - b.length) * 0.15 + Math.max(a.length, b.length) + (endsWeak(a) ? 12 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

/** Phrase-sized chunks: cut after . , ; : ! ? and dashes. */
function phrases(text: string): string[][] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.,;:!?–—]$/.test(w)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Pack phrases into pages (<= 2 lines x 42 chars); times are proportional to characters across `audioSeconds`. */
export function pageCaptions(text: string, audioSeconds: number): CaptionPage[] {
  const pageWords: string[][] = [];
  let cur: string[] = [];
  const fits = (w: string[]) => wrapTwo(w) !== null;
  const flush = () => {
    if (cur.length) pageWords.push(cur);
    cur = [];
  };
  for (const ph of phrases(text)) {
    if (fits([...cur, ...ph])) {
      cur = [...cur, ...ph];
      // end the page at a sentence end once it is reasonably full
      if (/[.!?]$/.test(cur[cur.length - 1]) && cur.join(" ").length > 28) flush();
      continue;
    }
    flush();
    // phrase alone too long: go word by word
    for (const w of ph) {
      if (fits([...cur, w])) cur.push(w);
      else {
        flush();
        cur = [w];
      }
    }
  }
  flush();
  const lengths = pageWords.map((w) => w.join(" ").length);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return pageWords.map((w, i) => {
    const start = (acc / total) * audioSeconds;
    acc += lengths[i];
    const end = (acc / total) * audioSeconds;
    // a single over-long word cannot be wrapped: keep it on one line rather than fail
    return { lines: wrapTwo(w) ?? [w.join(" ")], start, end };
  });
}

const stamp = (t: number): string => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(ms % 1000, 3)}`;
};

/** SRT text from pages with absolute times (seconds). */
export function toSrt(pages: CaptionPage[]): string {
  return pages.map((p, i) => `${i + 1}\n${stamp(p.start)} --> ${stamp(p.end)}\n${p.lines.join("\n")}\n`).join("\n");
}
