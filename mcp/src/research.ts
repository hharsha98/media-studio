import { USER_AGENT } from "./config.js";
import type { Source } from "./plan.js";

export interface Fact {
  text: string;
  source_id: string;
}
export interface ResearchResult {
  facts: Fact[];
  sources: Source[];
  note: string;
}

/** Titles from a MediaWiki `action=query&list=search` response. */
export function parseSearchTitles(json: any): string[] {
  const hits = json?.query?.search;
  return Array.isArray(hits) ? hits.map((h: any) => String(h.title)).filter(Boolean) : [];
}

/** First sentences of a REST page-summary response. */
export function parseSummary(json: any, maxSentences = 3): { title: string; url: string; sentences: string[] } | null {
  const extract = typeof json?.extract === "string" ? json.extract.trim() : "";
  if (!extract || json?.type === "disambiguation") return null;
  const sentences = (extract.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [extract]).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
  return {
    title: String(json.title ?? ""),
    url: String(json?.content_urls?.desktop?.page ?? ""),
    sentences: sentences.slice(0, maxSentences),
  };
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

export async function researchTopic(topic: string, language = "en", maxSources = 4): Promise<ResearchResult> {
  const lang = /^[a-z]{2,3}(-[a-z]+)?$/i.test(language) ? language.toLowerCase() : "en";
  const host = `https://${lang}.wikipedia.org`;
  const search = await getJson(`${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=${maxSources}`);
  const titles = parseSearchTitles(search);
  const sources: Source[] = [];
  const facts: Fact[] = [];
  for (const title of titles) {
    try {
      const sum = parseSummary(await getJson(`${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`));
      if (!sum) continue;
      const id = `s${sources.length + 1}`;
      sources.push({ id, title: sum.title || title, url: sum.url || `${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, publisher: "Wikipedia" });
      for (const text of sum.sentences) facts.push({ text, source_id: id });
    } catch {
      // one failing page must not lose the others
    }
  }
  return {
    facts,
    sources,
    note: "Wikipedia summaries are a fallback. Prefer your own web research from reputable sources and pass them as plan.sources. Facts are the opening sentences of each article; check them before use.",
  };
}
