# Flow: video from code (motion graphics, explainers, data stories, title sequences)

**Result:** an MP4 (or several shapes of it) rendered from React code with Remotion. Use this when there is no
screen recording to show, or when the video is the design itself: animated explainers, charts and data stories,
title sequences, kinetic type, product diagrams, social clips.
Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md). Renderer: Remotion (never Hyperframes).

## 1. Brief (short, in plain words)
Ask or infer: who watches, the one thing they should remember, where it will be posted (LinkedIn feed is square
1080x1080 or 4:5 1080x1350; Reels and Shorts are 1080x1920; sites and YouTube are 1920x1080), length (15 to 90 s),
sound (music, narration, captions only). Write `brief/brief.md` and a storyboard, one line per scene with its
seconds. Use real numbers and copy only: if the video shows data, the data comes from a file or source you name.
Show the plan and get a yes.

## 2. Load the Remotion skills
Load `remotion:remotion-best-practices` first (the router). Then load what the job needs:

| Job | Remotion skill |
|---|---|
| New composition, project layout, video layout | `remotion:remotion-create` |
| Animation, sequencing, transitions, text, audio, fonts, 3D, Lottie, effects | `remotion:remotion-markup` |
| Captions and subtitles (import SRT, display, transcribe) | `remotion:remotion-captions` |
| Maps, routes, geographic flyovers | `remotion:remotion-maps` |
| Video and audio metadata, trimming, cropping in the browser | `remotion:remotion-multimedia` |
| Rendering options, transparent video | `remotion:remotion-render` |
| Studio (the live preview), Studio flags | `remotion:remotion-studio` |
| Editable props in the Studio sidebar | `remotion:remotion-interactivity` |
| Looking up any Remotion API | `remotion:remotion-docs` |

If those skills are not installed: `/plugin install remotion@media-studio-marketplace`. Without them, read
https://www.remotion.dev/docs.

## 3. Build
- The project is `<MS>/video` (pinned Remotion; `src/index.ts` registers `src/Root.tsx`). Add a new file per video in
  `src/`, register it in `Root.tsx` with a short id (no spaces). Keep `Teaser.tsx` untouched unless asked.
- Put images, fonts, audio and video in `<MS>/video/public/<run-slug>/` and load them with `staticFile()`.
- Make every frame a pure function of the frame number (Remotion's model): no `Math.random()` or `Date.now()`
  without a seed, no CSS transitions, no `setTimeout`.
- Size scenes from data with `calculateMetadata` (for example from an audio file's length).
- Use the brand's own colours and fonts. System fonts are fine; web fonts need `@remotion/google-fonts` (network at render).
- Music and SFX: `node "<SKILL>/scripts/media.mjs" stage music/<file>.mp3 --to music` (see `teaser.md` for the beat method).
- Preview, if the user wants to steer: `npx remotion studio` in `<MS>/video`. It is a long-running server: stop it afterwards.

## 4. Render
`cd "<MS>/video"` then
`npx remotion render src/index.ts <CompositionId> "<run>/work/<name>-raw.mp4" --props="<run>/brief/props.json"`
Options worth knowing: `--codec=h264` (default, plays everywhere), `--crf=18` (lower is better and bigger),
`--scale=1`, `--frames=0-59` (render only a range to test), `--concurrency=50%`. Then master the sound if there is any:
`node "<SKILL>/scripts/media.mjs" master "<run>/work/<name>-raw.mp4" "<run>/out/<name>.mp4"`. No audio? Copy the file to `out/`.
Remotion's first render downloads nothing new: the browser was installed by setup.

## 5. Check and deliver
- `media.mjs sheet` then read the sheet; `media.mjs probe` for the true size, duration, fps and loudness.
- Look for clipped text, unreadable moments, jumpy motion, wrong aspect ratio, anything not from a real source.
- Privacy sweep of every frame. Ask the user to listen once if there is sound.
- `media.mjs add --run "<run>" --path "<run>/out/<name>.mp4" --kind video --alt "..." --credit "..."` and report paths, durations, alt text.
