import assert from "node:assert/strict";
import test from "node:test";
import { MAX_LINE, pageCaptions, toSrt } from "../captions.js";
import { cleanTitle, draftPlan } from "../draft.js";
import { estimateSeconds, validatePlan, wordCount } from "../plan.js";
import { parseSearchTitles, parseSummary } from "../research.js";
import { wavDurationSeconds } from "../wav.js";
import { wordErrorRate } from "../wer.js";
import { layoutScenes } from "../render.js";

const goodPlan = () => ({
  title: "Tides",
  description: "A short explainer on tides",
  style: "explainer",
  language: "en",
  length_seconds: 20,
  format: "16:9",
  author: "agent",
  sources: [{ id: "s1", title: "Tide", url: "https://en.wikipedia.org/wiki/Tide", publisher: "Wikipedia" }],
  scenes: [
    { id: "a", kind: "title", heading: "Tides", narration: "Why does the sea rise and fall every single day?" },
    { id: "b", kind: "bullets", heading: "Causes", items: ["Moon gravity", "Sun gravity"], narration: "The gravity of the Moon and the Sun pulls on the ocean, and Earth turns through the resulting bulges every day." },
    { id: "c", kind: "steps", items: ["One", "Two", "Three"], narration: "Spring tides happen when the Sun and Moon line up, and neap tides happen when they sit at right angles to each other." },
    { id: "d", kind: "end", narration: "" },
  ],
});

test("validatePlan accepts a good plan", () => {
  const r = validatePlan(goodPlan());
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.ok(r.estimated_seconds > 10);
});

test("validatePlan: stat without a source is an error", () => {
  const p: any = goodPlan();
  p.scenes.splice(2, 0, { id: "x", kind: "stat", value: "42%", label: "something", narration: "A number appears here." });
  const r = validatePlan(p);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /source_ids/.test(e)));
});

test("validatePlan: unknown source id, long narration, too few scenes", () => {
  const p: any = goodPlan();
  p.scenes[1].source_ids = ["nope"];
  p.scenes[2].narration = "x".repeat(601);
  assert.ok(validatePlan(p).errors.some((e) => /unknown source/.test(e)));
  assert.ok(validatePlan(p).errors.some((e) => /601/.test(e)));
  const q: any = goodPlan();
  q.scenes = [q.scenes[0]];
  assert.ok(validatePlan(q).errors.some((e) => /2 to 12/.test(e)));
});

test("validatePlan: image path must exist", () => {
  const p: any = goodPlan();
  p.scenes.splice(1, 0, { id: "i", kind: "image", image: { path: "/nope/missing.png", credit: "me" }, narration: "A picture." });
  assert.ok(validatePlan(p).errors.some((e) => /not found/.test(e)));
});

test("validatePlan: length warning, first-scene warning, URL warning", () => {
  const p: any = goodPlan();
  p.length_seconds = 60;
  p.scenes[0].kind = "bullets";
  p.scenes[0].items = ["a"];
  p.scenes[1].narration = "See https://example.com for details about all of this.";
  const r = validatePlan(p);
  assert.ok(r.warnings.some((w) => /25%/.test(w)));
  assert.ok(r.warnings.some((w) => /not a title/.test(w)));
  assert.ok(r.warnings.some((w) => /URL/.test(w)));
});

test("captions: pages are <= 2 lines of <= 42 chars and cover the audio", () => {
  const text =
    "The Moon's gravity pulls on the ocean. Water bulges toward it, and Earth rotates through those bulges, so most coasts see two high tides and two low tides a day.";
  const dur = 11.3;
  const pages = pageCaptions(text, dur);
  assert.ok(pages.length >= 2);
  for (const p of pages) {
    assert.ok(p.lines.length <= 2);
    for (const l of p.lines) assert.ok(l.length <= MAX_LINE, `line too long: ${l}`);
  }
  assert.equal(pages[0].start, 0);
  assert.ok(Math.abs(pages[pages.length - 1].end - dur) < 1e-6);
  for (let i = 1; i < pages.length; i++) assert.ok(Math.abs(pages[i].start - pages[i - 1].end) < 1e-9);
  assert.equal(pages.map((p) => p.lines.join(" ")).join(" "), text);
  assert.match(toSrt(pages), /^1\n00:00:00,000 --> /);
});

const facts = [
  { text: "Solar power is the conversion of energy from sunlight into electricity, either directly using photovoltaics or indirectly using concentrated solar power.", source_id: "s1" },
  { text: "Photovoltaic cells convert light into an electric current using the photovoltaic effect, which was first observed in the nineteenth century.", source_id: "s1" },
  { text: "Wholesale electricity markets match supply and demand for each delivery period, and the market sets a single clearing price for that period.", source_id: "s2" },
  { text: "Producers submit offers, buyers submit bids, and an auction algorithm selects the cheapest combination that meets demand in every period.", source_id: "s2" },
  { text: "Because the fuel is free, solar plants can offer electricity at very low marginal cost, which tends to lower prices around midday.", source_id: "s2" },
  { text: "Weather forecasts help producers estimate how much power they can deliver in each hour of the following day.", source_id: "s2" },
];
const srcs = [
  { id: "s1", title: "Solar power", url: "https://en.wikipedia.org/wiki/Solar_power", publisher: "Wikipedia" },
  { id: "s2", title: "Electricity market", url: "https://en.wikipedia.org/wiki/Electricity_market", publisher: "Wikipedia" },
];

test("draftPlan passes validatePlan and lands within 25% of the length", () => {
  for (const L of [20, 30, 45, 60]) {
    const plan = draftPlan({ description: "A short explainer on how solar power is traded on electricity markets", length_seconds: L, facts, sources: srcs });
    const v = validatePlan(plan);
    assert.equal(v.ok, true, `${L}s: ${v.errors.join("; ")}`);
    assert.equal(plan.author, "server-fallback");
    const est = estimateSeconds(plan.scenes);
    assert.ok(Math.abs(est - L) / L <= 0.25, `${L}s requested, estimated ${est}`);
  }
});

test("draftPlan refuses to run without facts (never reads the request aloud)", () => {
  assert.throws(() => draftPlan({ description: "Explain how a bicycle stays upright while moving.", length_seconds: 15 }), /needs facts/);
});

test("draftPlan skips sentences that are too long and never returns an invalid plan", () => {
  const long = "Ground-source heat pumps, or geothermal heat pumps as they are commonly termed in North America, are among the most energy-efficient technologies for providing heating, cooling and water heating, using far less energy than resistive electric heaters do.";
  const short = "A heat pump moves heat from a cold place to a warm place using electricity.";
  const sources = [{ id: "s1", title: "Heat pump", url: "https://en.wikipedia.org/wiki/Heat_pump" }, { id: "s2", title: "Ground source heat pump", url: "https://en.wikipedia.org/wiki/Ground_source_heat_pump" }];
  const plan = draftPlan({ description: "How a heat pump heats a home", length_seconds: 20, facts: [{ text: short, source_id: "s1" }, { text: long, source_id: "s2" }], sources });
  assert.equal(validatePlan(plan).ok, true);
  assert.ok(plan.scenes.every((s) => (s.items ?? []).every((i) => i.length <= 190)));
  assert.throws(() => draftPlan({ description: "x", length_seconds: 20, facts: [{ text: long, source_id: "s2" }], sources }), /no whole sentence/);
});

test("wordErrorRate", () => {
  assert.equal(wordErrorRate("The cat sat.", "the cat sat"), 0);
  assert.equal(wordErrorRate("the cat sat on the mat", "the cat sat on a mat"), 1 / 6);
  assert.equal(wordErrorRate("one two", ""), 1);
  assert.equal(wordErrorRate("", ""), 0);
});

test("wavDurationSeconds reads the header", () => {
  const sr = 24000;
  const samples = sr * 2; // 2 s of 16-bit mono
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(samples * 2, 40);
  assert.equal(wavDurationSeconds(b), 2);
  b.writeUInt32LE(0xffffffff, 40); // streamed file
  assert.equal(wavDurationSeconds(b), 2);
  assert.throws(() => wavDurationSeconds(Buffer.from("nope")));
});

test("Wikipedia response parsing (fixtures)", () => {
  const search = { query: { search: [{ title: "Day-ahead market" }, { title: "Electricity market" }] } };
  assert.deepEqual(parseSearchTitles(search), ["Day-ahead market", "Electricity market"]);
  assert.deepEqual(parseSearchTitles({}), []);
  const summary = {
    title: "Electricity market",
    extract: "An electricity market is a system enabling purchases, through bids to buy. Sales are made through offers to sell. Short.",
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Electricity_market" } },
  };
  const s = parseSummary(summary)!;
  assert.equal(s.url, "https://en.wikipedia.org/wiki/Electricity_market");
  assert.equal(s.sentences.length, 2);
  assert.equal(parseSummary({ type: "disambiguation", extract: "x may refer to" }), null);
});

test("layoutScenes: durations follow the audio, title and end have minimums", () => {
  const plan: any = goodPlan();
  const t = layoutScenes(plan, { a: 1, b: 6, c: 6 });
  assert.equal(t[0].durationFrames, Math.round(2.5 * 30));
  assert.equal(t[3].durationFrames, Math.round(3.5 * 30));
  assert.equal(t[1].durationFrames, Math.round((6 + 0.35 + 0.45) * 30));
  assert.equal(t[2].startFrame, t[0].durationFrames + t[1].durationFrames);
  assert.ok(wordCount("a b c") === 3);
});

test("fallback: narration always ends with . ! or ?, headings are source titles", () => {
  const messy = [{ text: "A heat pump (pronounced heet) is a device that uses mechanical or thermal energy to transfer heat from one place to another and keep a building warm in winter. It moves heat rather than burning fuel to make it. Some designs work best when the outdoor air is mild and it is cut", source_id: "h1" }];
  for (const L of [20, 30, 60]) {
    const plan = draftPlan({ description: "A 20-second explainer on how a heat pump heats a home", length_seconds: L, facts: [...messy, ...facts], sources: [{ id: "h1", title: "Heat pump", url: "https://en.wikipedia.org/wiki/Heat_pump" }, ...srcs] });
    assert.equal(validatePlan(plan).ok, true);
    for (const s of plan.scenes.filter((x) => x.narration)) assert.match(s.narration, /[.!?]$/, s.narration);
    for (const s of plan.scenes) if (s.kind === "bullets") for (const it of s.items ?? []) assert.match(it, /[.!?]$/);
    assert.ok(!plan.scenes.some((s) => /^Key point/.test(s.heading ?? "")));
    assert.ok(plan.scenes.some((s) => s.heading === "Heat pump"));
    assert.ok(!plan.scenes.some((s) => /pronounced/.test(s.narration)));
  }
});

test("fallback: title is clean and the raw request is never spoken", () => {
  const description = "A 20-second explainer on how a heat pump heats a home";
  const plan = draftPlan({ description, length_seconds: 20, facts, sources: srcs });
  assert.equal(plan.scenes[0].heading, "How a heat pump heats a home");
  assert.equal(plan.scenes[0].narration, "How a heat pump heats a home.");
  for (const s of plan.scenes) {
    assert.ok(!/second|minute/i.test(s.narration + (s.heading ?? "")));
    assert.ok(!s.narration.includes(description));
  }
  assert.equal(cleanTitle("A 2-minute teaser about our new app"), "Our new app");
});
