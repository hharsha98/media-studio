import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { msHome, voiceStudioUrl } from "./config.js";
import { wavDurationSeconds } from "./wav.js";

/** Engines whose model weights are non-commercial: refused, never selected or used. */
export const NON_COMMERCIAL = new Set(["omnivoice", "omnivoice-gguf", "audiocpp"]);

/** The direction that made the "Aiden" voice a good presenter (same text as the plugin's speak.mjs). */
export const PRESENTER =
  "Warm, confident, friendly tech presenter showing a colleague a new tool. Conversational and upbeat, not salesy. Brisk, steady pace. End each sentence on a confident, falling tone.";

export interface VoiceInfo {
  reachable: boolean;
  error?: string;
  engine?: string;
  model?: string;
  allowed?: boolean;
  licence_note?: string;
}
export interface VoiceSettings {
  voice?: string;
  instructions?: string;
  speed?: number;
  language?: string;
}

const get = (p: string, ms = 8000) => fetch(voiceStudioUrl() + p, { signal: AbortSignal.timeout(ms) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function voiceInfo(): Promise<VoiceInfo> {
  try {
    const h = await get("/health");
    if (!h.ok) return { reachable: false, error: `health answered HTTP ${h.status}` };
  } catch (e) {
    return { reachable: false, error: `not reachable at ${voiceStudioUrl()} (${(e as Error).message})` };
  }
  try {
    const eng: any = await (await get("/engines/tts")).json();
    const engine = String(eng.active ?? "");
    const model = typeof eng.active_model === "string" ? eng.active_model : JSON.stringify(eng.active_model ?? "");
    const allowed = !NON_COMMERCIAL.has(engine);
    return {
      reachable: true,
      engine,
      model,
      allowed,
      licence_note: allowed
        ? "Engine accepted. Qwen3-TTS CustomVoice and Kokoro are Apache-2.0."
        : `The "${engine}" engine uses weights with non-commercial terms. Choose Qwen3-TTS CustomVoice or Kokoro in VoiceStudio (Settings, Engines).`,
    };
  } catch (e) {
    return { reachable: true, error: `could not read /engines/tts (${(e as Error).message})` };
  }
}

export async function asrInfo(): Promise<{ available: boolean; engine?: string; model?: string; reason?: string }> {
  try {
    const res = await get("/engines/asr");
    if (!res.ok) return { available: false, reason: `GET /engines/asr answered HTTP ${res.status}` };
    const j: any = await res.json();
    if (!j.active) return { available: false, reason: "no active speech-to-text engine" };
    return { available: true, engine: String(j.active), model: typeof j.active_model === "string" ? j.active_model : undefined };
  } catch (e) {
    return { available: false, reason: (e as Error).message };
  }
}

/** Default voice by engine, as in speak.mjs; a user default in <MEDIA_STUDIO_HOME>/voice.json wins. */
export function defaultVoice(model: string): VoiceSettings {
  try {
    const mine = JSON.parse(fs.readFileSync(path.join(msHome() || os.homedir(), "voice.json"), "utf8"));
    if (mine && typeof mine.voice === "string") return mine;
  } catch {
    // no personal default
  }
  if (/qwen3-tts.*customvoice/i.test(model)) return { voice: "Aiden", instructions: PRESENTER };
  if (/kokoro/i.test(model)) return { voice: "af_bella", speed: 1.1, language: "en" };
  return { voice: "default", speed: 1, language: "en" };
}

export interface SynthResult {
  wav: Buffer;
  seconds: number;
}

/** One narration clip. Refuses non-commercial engines. Retries 503 (model loading) for up to 90 s. */
export async function synthesize(text: string, settings: VoiceSettings): Promise<SynthResult> {
  const body: Record<string, unknown> = { input: text, response_format: "wav", voice: settings.voice };
  if (settings.instructions) body.instructions = settings.instructions;
  if (settings.speed !== undefined) body.speed = settings.speed;
  if (settings.language) body.language = settings.language;
  const deadline = Date.now() + 90_000;
  let delay = 2000;
  for (;;) {
    const res = await fetch(voiceStudioUrl() + "/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5 * 60_000),
    });
    const type = res.headers.get("content-type") || "";
    if (res.status === 503 && Date.now() < deadline) {
      await sleep(delay);
      delay = Math.min(delay * 1.5, 10_000);
      continue;
    }
    if (!res.ok || !type.startsWith("audio/")) {
      throw new Error(`VoiceStudio did not return audio (HTTP ${res.status}, ${type}): ${(await res.text()).slice(0, 300)}`);
    }
    const wav = Buffer.from(await res.arrayBuffer());
    return { wav, seconds: wavDurationSeconds(wav) };
  }
}

/** Speech-to-text of a WAV file with the active ASR engine. */
export async function transcribe(wavPath: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(wavPath)], { type: "audio/wav" }), path.basename(wavPath));
  form.append("response_format", "json");
  const res = await fetch(voiceStudioUrl() + "/v1/audio/transcriptions", { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`transcription HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return String(j.text ?? "");
}
