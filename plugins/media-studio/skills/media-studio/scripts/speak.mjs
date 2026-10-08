#!/usr/bin/env node
/**
 * Make one narration clip with a VoiceStudio app that is already running on this computer.
 * No curl needed (works on Windows too). It never starts or installs VoiceStudio.
 *
 *   node speak.mjs "Text to say." out.wav [--voice default] [--speed 1] [--language en] [--model mlx-audio]
 *   node speak.mjs --file line-01.txt out.wav
 *
 * Safety: it first asks VoiceStudio which engine is active and REFUSES the engines whose model weights are
 * non-commercial for published media (omnivoice, audiocpp) unless you pass --allow-engine <id>.
 * Pick another engine in VoiceStudio (Settings, Engines) or pass --model. See flows/voice.md.
 */
import fs from "node:fs";
import path from "node:path";
import { ffx } from "./lib/tools.mjs";

const BASE = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const fileArg = opt("file");
const positional = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
const text = fileArg ? fs.readFileSync(fileArg, "utf8").trim() : positional[0];
const out = fileArg ? positional[0] : positional[1];
if (!text || !out) { console.error('usage: node speak.mjs "text" out.wav [--voice default] [--speed 1] [--language en] [--model <engine id>]'); process.exit(1); }
if (text.length > 4096) { console.error("VoiceStudio accepts at most 4096 characters per request. Split the text into lines."); process.exit(1); }

const NON_COMMERCIAL = new Set(["omnivoice", "omnivoice-gguf", "audiocpp"]);
const get = async (p) => (await fetch(BASE + p, { signal: AbortSignal.timeout(8000) }));

try {
  const h = await get("/health");
  if (!h.ok) throw new Error("health answered HTTP " + h.status);
} catch (e) {
  console.error(`VoiceStudio is not reachable at ${BASE} (${e.message}). Start the app, or use your own recording or captions only (flows/voice.md).`);
  process.exit(2);
}

const eng = await (await get("/engines/tts")).json().catch(() => ({}));
const engine = opt("model") || eng.active;
const allow = opt("allow-engine");
console.log(`engine: ${engine}${eng.active_model && !opt("model") ? ` (${typeof eng.active_model === "string" ? eng.active_model : JSON.stringify(eng.active_model)})` : ""}`);
if (engine && NON_COMMERCIAL.has(engine) && allow !== engine) {
  console.error(`Refusing: the "${engine}" engine uses weights with non-commercial terms. Choose another engine in VoiceStudio (Settings, Engines; on Apple Silicon use mlx-audio with Kokoro), or pass --allow-engine ${engine} if you have checked the licence for your use.`);
  process.exit(3);
}

const body = { input: text, response_format: "wav", voice: opt("voice", "default"), speed: Number(opt("speed", 1)), language: opt("language", "en") };
if (opt("model")) body.model = opt("model");
const res = await fetch(BASE + "/v1/audio/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10 * 60 * 1000) });
const type = res.headers.get("content-type") || "";
if (!res.ok || !type.startsWith("audio/")) {
  console.error(`VoiceStudio did not return audio (HTTP ${res.status}, ${type}): ${(await res.text()).slice(0, 400)}`);
  process.exit(4);
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
const p = ffx("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "default=nw=1", out]);
if (!p.ok) { console.error("The saved file is not readable audio:\n" + (p.stderr || p.stdout)); process.exit(5); }
console.log(`${path.resolve(out)}\n${p.stdout.trim().replace(/\n/g, "  ")}`);
