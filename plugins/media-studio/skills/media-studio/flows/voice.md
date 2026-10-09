# Flow: narration (voiceover)

**Result:** one WAV file per script line, made locally and free with VoiceStudio, or the user's own recording, or no
narration at all (captions only). Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md).
This guide is our own summary of VoiceStudio's public API. VoiceStudio is a separate app the user installs and runs
themselves; media-studio does not bundle, install or start it.

## Choose the route
1. **VoiceStudio (local, free).** Open source (AGPL-3.0 for the app). Get it from
   https://github.com/debpalash/VoiceStudio (see its Releases page and README for your OS). Everything runs on the computer.
2. **The user's own voice.** Record each script line with any recorder (Voice Memos, QuickTime, Windows Voice Recorder,
   Audacity) and save WAV. Best for a personal brand. Check each file with `media.mjs probe`.
3. **Captions only.** LinkedIn plays video muted, so a captioned video without voice is a normal, honest choice.
Never use a paid voice API (ElevenLabs and similar) without the user's explicit yes, a named price and a named provider.

## The one rule that matters: pick a commercially usable engine
VoiceStudio can run many engines. Its DEFAULT engine, OmniVoice, uses model weights with non-commercial terms. Do not use
it for anything the user publishes for business. Check an engine's licence on its model card before using it.
- Apple Silicon Mac, **recommended voice: "Aiden", directed.** In VoiceStudio choose the **MLX-Audio** engine with the
  model `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit` (Qwen3-TTS, Apache-2.0, about 2.5 GB, downloaded once the
  first time it speaks). It takes a written direction, so it does not sound flat. `scripts/speak.mjs` uses it
  automatically: voice `Aiden` with the direction "Warm, confident, friendly tech presenter showing a colleague a new
  tool. Conversational and upbeat, not salesy. Brisk, steady pace. End each sentence on a confident, falling tone."
  Alternative speaker: `Ryan`. Do not send `language` (Qwen3 does not know "en"; leaving it out means auto) and do not rely
  on `speed` (not supported for this model yet): steer pace through the direction instead.
- Apple Silicon Mac, **lighter option, no big download:** the **Kokoro** model (Kokoro-82M, Apache-2.0). `speak.mjs` then
  uses `af_bella` (warm American female, graded A- by Kokoro's makers) at speed 1.2, about 150 words a minute. Kokoro's
  male voices are graded C+ or lower. Its engine id for the API is `mlx-audio`.
- To make a choice stick when the app is opened normally, select it in VoiceStudio (Settings, Engines) or
  `POST /engines/select {"family":"tts","backend_id":"mlx-audio","model_id":"<model id>"}`. A personal default can also go
  in `<MS>/voice.json`, e.g. `{"voice":"Aiden","instructions":"..."}`; `--voice` on the command line always wins.
- Windows or Linux: MLX-Audio is Apple-only. In VoiceStudio's model catalogue pick an engine whose label says Apache-2.0 or
  MIT (the app shows each engine's licence in its label; `GET /engines/tts` lists them). Kokoro is also offered through the
  Sherpa-ONNX engine. Confirm the model card before use.
- `scripts/speak.mjs` asks VoiceStudio for its active engine first and refuses `omnivoice`, `omnivoice-gguf` and `audiocpp`
  unless the user passes `--allow-engine`.

## Connect (facts about VoiceStudio's public API)
- Default address `http://127.0.0.1:3900` (`localhost` works too). `GET /health` returns JSON such as
  `{"status":"ok","device":...,"version":...}`. While a model loads it can answer 503: wait and retry.
- `GET /openapi.json` lists every endpoint of the running version. `GET /engines/tts` shows the active engine and the choices.
  `GET /v1/audio/voices` lists voices. Do not invent voice profile ids.
- `POST /v1/audio/speech` is OpenAI-compatible: JSON `{"input": "text (max 4096 chars)", "model": "<engine id, optional>",
  "voice": "default or a profile id", "response_format": "wav", "speed": 1.0, "language": "en"}`. The reply is audio bytes.
  Always check the HTTP status and the content type before calling it audio: an error is JSON, not a WAV.
- `POST /v1/audio/transcriptions` (multipart: `file`, `model`, `response_format` one of `json`, `text`, `verbose_json`,
  `srt`, `vtt`) turns audio into text or subtitles. Make sure a speech-to-text model is installed first; if not, tell the user
  and let them approve the download.
- MCP: the running app also mounts an MCP server at `http://127.0.0.1:3900/mcp/` (keep the trailing slash). Not needed here.
- Privacy: VoiceStudio sends nothing out by default; its optional analytics are opt-in. `OMNIVOICE_ANALYTICS_DISABLED=1` in
  its environment disables them entirely. Never print or store an auth token if the app is configured with one.

## What matters more than the voice (LinkedIn)
- **Captions first.** LinkedIn's own study (2021, 3,500+ ads) found 79% of feed videos are watched with the sound off,
  and LinkedIn autoplays muted. Burn captions in: 1-2 lines, at most about 42 characters a line, 2-4 seconds each. The
  first 3 seconds must make sense with no sound.
- **One audio source.** The same study found voice plus a music track lowered completion. Use narration only, or keep music
  barely audible under it.
- **Pace 150-165 words a minute**, warm and conversational, falling tone at the end of sentences. Two or three sentences
  per request sound more natural than one short line.

## Make the clips
1. Write the script as numbered lines, about 2.5 words a second. Keep each line under 4096 characters (one sentence or two).
2. Save each line as `voice/line-NN.txt`. Use the SAME text for the on-screen caption.
3. Make a test line first and confirm the engine in the output:
   `node "<SKILL>/scripts/speak.mjs" --file "<run>/voice/line-01.txt" "<run>/voice/line-01.wav"`
   It prints the engine, the file path, the real duration and sample rate. Listen (ask the user), fix pace with `--speed 0.95`.
4. Repeat for every line. Use the same `--voice` for the whole video. Clone only voices the speaker has agreed to.
5. Check every file with `node "<SKILL>/scripts/media.mjs" probe <wav>`; durations drive the scene lengths in Remotion
   (`calculateMetadata`). Copy the WAVs into `<MS>/video/public/<run-slug>/voiceover/`.
6. Label the video "AI voice" when the narration is synthetic. Keep music about 0.15 under speech.
7. After rendering, transcribe the final audio (`/v1/audio/transcriptions`, `response_format=srt`) and diff it with the
   script: any line that differs gets regenerated.

## When VoiceStudio is not running
`node "<SKILL>/scripts/check.mjs"` reports it as "skip". Do not start or install it for the user. Offer the three routes
above and let them choose.
