# Media Studio MCP

It started as the media-studio Claude Code plugin; this is its MCP server, so any agent can call it. An agent sends a plain description (or a finished video plan) and gets back a short rendered video plus a neutral run report: what was asked, what was measured, how long each step took.

## Requirements

- Node 20 or newer.
- The media-studio workspace (`~/MediaStudio`, or the folder in `MEDIA_STUDIO_HOME`), created by `/media-studio:setup` in Claude Code: it holds the Remotion project in `video/`, music and the runs folder.
- VoiceStudio running locally (default `http://127.0.0.1:3900`) with a commercially usable engine: Qwen3-TTS CustomVoice or Kokoro (both Apache-2.0). The server refuses OmniVoice, OmniVoice-GGUF and audio.cpp (non-commercial weights) and never changes VoiceStudio's engine.
- The helper `plugins/media-studio/skills/media-studio/scripts/media.mjs` from this repo (found automatically; override with `MEDIA_STUDIO_SCRIPTS`).

## Install

```sh
cd mcp && npm install     # also builds dist/ (the prepare script runs tsc)
npm test                  # unit tests, no network
npm run smoke             # real end-to-end render (needs VoiceStudio)
```

## Connect

Claude Code:

```sh
claude mcp add media-studio -s user -- node /absolute/path/to/media-studio/mcp/dist/index.js
```

Cursor, in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "media-studio": { "command": "node", "args": ["/absolute/path/to/media-studio/mcp/dist/index.js"] }
  }
}
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDIA_STUDIO_HOME` | `~/MediaStudio` | workspace with `video/`, `runs/`, `assets/` |
| `VOICESTUDIO_URL` | `http://127.0.0.1:3900` | local VoiceStudio |
| `MEDIA_STUDIO_SCRIPTS` | plugin folder next to `mcp/` | folder containing `media.mjs` |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | unset | optional: one trace per job, one span per step. Never required. |

## Tools and prompt

| Name | What it does |
| --- | --- |
| `check_setup` | Node, Remotion project, media.mjs, ffmpeg, VoiceStudio engine and licence, speech-to-text, disk |
| `research_topic` | Wikipedia fallback: facts and sources in plan format. Agents should prefer their own web research |
| `get_style_guide` | style presets, scene kinds, an example plan, writing rules |
| `draft_plan` | deterministic fallback plan (author `server-fallback`) |
| `validate_plan` | errors, warnings and estimated length |
| `render_video` | validate, queue, return `job_id` at once (one render at a time) |
| `get_job` | long-poll status; when done: video path, report, contact sheet image |
| `report_usage` | attach tokens/cost your client reports; the server never guesses |
| `list_runs` | recent runs from disk |
| prompt `make_video` | step-by-step instructions for the calling agent |

Scene kinds: `title`, `bullets`, `stat`, `quote`, `steps`, `compare`, `chart`, `image`, `end`. Styles: `explainer`, `teaser`, `data-story`, `pitch`, `tutorial`, `news`, `custom`; `theme` colours in the plan override the preset.

## Example request

To the agent: "Make a 25-second explainer on how solar power is traded on the day-ahead electricity market." The agent follows the `make_video` steps: `check_setup`, its own web research, `get_style_guide`, writes the plan with sources, `validate_plan`, `render_video`, then `get_job` with `wait_seconds: 45` until done. See `scripts/smoke.mjs` for a complete plan.

## What the report contains

`out/report.md` and `out/report.json`: request; rendered yes/no; video size, resolution, fps, duration; requested versus actual duration; loudness versus the -14 LUFS target; voice engine, model, voice and licence note; voice-versus-caption word error rate per scene (via VoiceStudio speech-to-text, or "not measured" with the reason); script author, words and spoken words per second; sources; seconds per step; client-reported usage or "not reported by the client"; file paths; tracing status. Values sit next to targets; there are no scores or pass/fail gates.

Each run lives in `<MEDIA_STUDIO_HOME>/runs/<date>-mcp-<slug>-<id>/` with `brief/plan.json`, `out/video.mp4`, `captions.srt`, `thumbnail.png`, `contact-sheet.png`, the reports and `job.json`.

## Limits

- Local only; tested on macOS (Apple Silicon). The server speaks stdio and writes nothing else to stdout.
- VoiceStudio is required for narration. Without it, `render_video` fails at the voice step.
- Remotion licence: free for individuals and companies of up to 3 people; larger companies need a company licence (remotion.pro).
- Disk: about 1 GB for the Remotion project plus about 100 MB per run (the unmastered render is deleted after mastering). Render time: roughly 15 to 20 s of render plus 15 to 35 s of voice for a 25 s video on an M-series Mac.
- The server copies `mcp/remotion/` into `<MEDIA_STUDIO_HOME>/video/src/media-studio-mcp/` before each render.
- Estimated length uses 2.8 spoken words per second, measured on the default "Aiden" voice.
