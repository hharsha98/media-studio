---
name: media-studio
description: >
  Make honest media for LinkedIn and the web from any project, app or website URL: 15 to 25 second launch
  teasers with music ("brag about this", /brag, launch video, product teaser), videos from code (Remotion
  motion graphics, explainers, data stories, title sequences), narrated demo videos and walkthroughs of a real
  app (LinkedIn video), LinkedIn images and carousels (PDF document posts), social cards and OG images,
  thumbnails, screenshots and device frames, website heroes and scroll animations (scrollytelling, landing
  page visuals), voiceover and narration, and "make media for my LinkedIn post". Works on macOS, Windows and
  Linux, for any project, any app or any website URL. Real product footage only, no invented UI.
---

# media-studio

One skill for the media around a post, a launch or a landing page. It routes your request to a flow, keeps
every file in one workspace, and only ever shows the real product.

## Start every run here

- Skill folder (SKILL): `${CLAUDE_SKILL_DIR}`   Plugin root: `${CLAUDE_PLUGIN_ROOT}`
- Run `node "${CLAUDE_SKILL_DIR}/scripts/check.mjs" --paths`. It prints the workspace (MS, default `~/MediaStudio`), the
  Remotion project (`video`), the fetched assets folder, and the browser it found. Use those exact paths.
- Run `node "${CLAUDE_SKILL_DIR}/scripts/check.mjs"` for the readiness table. If a required row says FAIL, tell
  the user to run `/media-studio:setup` and stop. Never install things behind their back.
- If the two folders above look empty or unexpanded, ask the user to run `/media-studio:check`, or look for
  `media-studio/skills/media-studio/scripts/check.mjs` under `~/.claude/plugins`.
- Flow files below use `<SKILL>` and `<MS>` for those two folders. Replace them with the real paths.
- Explain what you are doing in plain words. The user may be new to video and code.

## Router: request to flow (read the flow file before you start)

| The user wants | Flow file | Main tools |
|---|---|---|
| A 15 to 25 s launch teaser with music ("brag about this", launch video, product teaser) | `<SKILL>/flows/teaser.md` | brag method + Remotion + bundled music |
| A video made from code: motion graphics, explainer, data story, title sequence | `<SKILL>/flows/video.md` | Remotion project + the Remotion skills |
| A narrated demo or walkthrough of a real app, plus a 30 s vertical cut | `<SKILL>/flows/demo.md` | capture, narration, Remotion |
| Images: LinkedIn image, carousel (PDF), social or OG card, thumbnail, screenshot, device frame | `<SKILL>/flows/stills.md` | HTML + `still.mjs` |
| A website hero, scroll animation, scrollytelling or landing-page visuals | `<SKILL>/flows/web.md` | scroll-craft |
| A voiceover or narration | `<SKILL>/flows/voice.md` | VoiceStudio ("Aiden", directed; or Kokoro "Bella"), or your own recording, or captions |
| "Make media for my LinkedIn post", or handing files to the LinkedIn skills | `<SKILL>/flows/linkedin.md` | `media.json` contract |
| First-time install, something is missing, or an upgrade | `<SKILL>/flows/setup.md` | `/media-studio:setup` |

If the request is unclear, ask which outputs they want. A good default offer for a product launch: one 20 s
teaser (square or vertical) plus one 1200x630 card plus alt text. Several flows often combine (a teaser plus a card).

## Shared rules (every flow)

1. **Workspace.** Work in `<MS>/runs/<YYYY-MM-DD>-<slug>/` (`brief/ capture/ voice/ stills/ work/ out/`).
   Never write into the user's project or repo unless they ask. Final files go in `out/`, scratch in `work/`.
2. **Ask first (clear yes, name the item, source and size) before:** any paid call (kie.ai, ElevenLabs, Pixfaro,
   any hosted image, video or voice API); any download over 100 MB; any app, plugin or global install; posting or
   scheduling anything. The plugin itself spends nothing: every default path is free and local.
3. **Honesty.** Real product UI only (real screenshots or screen recordings). No mock screens built from divs, no
   generated UI, no fictional stand-ins. Label recordings ("Screen recording, <app> v<version>"), AI voice and music.
   Report true durations. Any trim or speed-up gets a label ("2x"). No invented numbers, counters, users or benchmarks.
4. **Privacy sweep of every frame and still** before delivery: no API keys or tokens, emails, home-folder paths,
   hostnames, customer data, or anything covered by an employer or NDA. Hide by blur or crop, never by replacing
   real content with fake content.
5. **LOOK at every output.** Read every PNG, and make a contact sheet of every video
   (`node "<SKILL>/scripts/media.mjs" sheet <video> <out.png>`) and read it. Claude cannot hear: say so, and ask the
   user to listen once with sound. Fix overflow, clipped text, low contrast and mid-transition mush before delivery.
6. **Licences and credits.** Music is "Music: Sascha Ende (ende.app), CC BY 4.0" (keep the line in the video or
   post). SFX are CC0. Remotion is free for individuals and companies of up to 3 people; larger companies need a
   Remotion company licence (https://www.remotion.pro/license). See `<SKILL>/THIRD_PARTY_NOTICES.md`.
7. **Deliver** file paths, true durations and sizes, alt text, and the credits to keep. Write
   `out/media.json` with `node "<SKILL>/scripts/media.mjs" add ...` (see `<SKILL>/flows/linkedin.md`).
   Offer post copy only through the user's own LinkedIn skills. Never post, publish or schedule.

## Tools (all Node, same on macOS, Windows and Linux)

| Need | Command |
|---|---|
| Resolved paths, readiness | `node "<SKILL>/scripts/check.mjs" --paths` / `check.mjs` |
| HTML to PNG, PNG set or multi-page PDF | `node "<SKILL>/scripts/still.mjs" page.html --png out.png --width 1200 --height 630` |
| Size, duration, fps, loudness of a file | `node "<SKILL>/scripts/media.mjs" probe <file>` |
| Contact sheet of a video | `node "<SKILL>/scripts/media.mjs" sheet <video> <out.png>` |
| Beat times and cut suggestions for a track | `node "<SKILL>/scripts/media.mjs" beats <track> --to 8 --cuts 2 --total 6` |
| Copy music/SFX into the Remotion project | `node "<SKILL>/scripts/media.mjs" stage music/<file>.mp3 --to music` |
| Normalise loudness to -14 LUFS | `node "<SKILL>/scripts/media.mjs" master in.mp4 out.mp4` |
| ffmpeg / ffprobe | `node "<SKILL>/scripts/media.mjs" ffmpeg ...` (Remotion's bundled build, see below) |
| Render a Remotion video | `cd "<MS>/video"` then `npx remotion render src/index.ts <CompositionId> <out.mp4> --props=<props.json>` |
| Scrub-friendly clip for a website | `node "<SKILL>/scripts/encode.mjs" in.mp4 out.mp4 [mobile]` |

- **Remotion's bundled ffmpeg is a stripped build:** it has scale, concat, loudnorm, amix and volume, but no tile, fps,
  ebur128 or drawtext. Use `-r 30` instead of `fps`, loudnorm for loudness, and `media.mjs sheet` for contact sheets.
  A full system ffmpeg is optional (set `MEDIA_STUDIO_USE_SYSTEM_FFMPEG=1`); the website flow needs one.
- **Remotion skills.** Before writing Remotion code, load the `remotion:remotion-best-practices` skill (installed
  as a dependency of this plugin). If it is missing: `/plugin install remotion@media-studio-marketplace`.
- **Vendored guides (read only what the flow tells you to):** `<SKILL>/vendor/brag/` (teaser method, tones, audio rules,
  MIT) and `<SKILL>/vendor/scroll-craft/` (website craft, MIT). They are renamed `GUIDE.md` so they do not register as
  separate skills. `<SKILL>/vendor/brag/` talks about Hyperframes: ignore that, render with Remotion.
- **Windows:** the Node tools work as they are. The flow files show bash-style commands; in PowerShell use full paths
  in quotes. `encode.sh` (bash) is replaced by `encode.mjs`. On Linux, Remotion's browser needs a few system libraries
  (see `<SKILL>/flows/setup.md`).
