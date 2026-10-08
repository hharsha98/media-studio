# Flow: launch teaser (15 to 25 seconds, with music)

**Result:** an MP4 (square 1080x1080 is the LinkedIn feed default; vertical 1080x1920 or wide 1920x1080 on request),
30 fps, with music and a few sound effects, plus a poster frame, share copy, alt text and credits.
**Method:** the "brag" method (vendored, MIT): find the story, plan a storyboard, build, check, deliver.
**Renderer:** Remotion. Do NOT use Hyperframes (unaudited, telemetry on by default). Works from a project
folder or from a website URL. Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md).

## 0. Decide the inputs (ask only what you cannot infer)
- The subject: a project folder (default if you are inside one) or a website URL / bare domain.
- Format: square (default), vertical (`TeaserVertical`) or wide (`TeaserWide`). Tone: `default`, `polished`,
  `yc-parody`, `chaotic`, `deadpan`, `cinematic`, `app-store`, or the user's own words (definitions in `<SKILL>/vendor/brag/references/tones.md`).
- Music on by default; narration only if asked (then follow `<SKILL>/flows/voice.md` and duck the music to about 0.15).
- Create the run folder `<MS>/runs/<date>-<slug>/` with `brief/ capture/ work/ out/`.

## 1. Inspect (real material only)
Read `<SKILL>/vendor/brag/references/step-1-inspect.md` and answer its nine questions (what is it, who for, what makes it
different, the boldest claim, the visual hook, the real UI to show, the tone, the one-line caption).
- **Project folder:** read the main page, styles (exact colours and fonts), README, routes and key components. The best
  material is the product in use: entry, key action, result. To get pixels, run the app (ask the user how, never guess a
  command) and capture it with `<SKILL>/flows/demo.md` step 2, or reuse real components in a Remotion composition.
- **Website URL:** `node "<SKILL>/scripts/capture.mjs" <url> --out "<run>/capture"` saves screenshots (one per screen) and
  `page-info.json` (title, headings, buttons, fonts, colours). Read both. It never clicks or logs in.
- Never invent product state, users, numbers or testimonials. Hide private data by blur or crop.

## 2. Plan the story
Write `brief/brag-plan.md` following `<SKILL>/vendor/brag/references/step-2-plan.md`: angle, hook (first 2 seconds), 2 to 3
highlights, punchline, tone, visual identity, then a scene-by-scene storyboard whose durations add up to 15 to 25 s
(18 to 22 is the sweet spot). Creative laws (short, readable, specific, show the thing, no generic SaaS words, hook first)
are in `<SKILL>/vendor/brag/GUIDE.md`. A line the viewer must read stays fully visible for about 0.3 s per word.
Show the plan to the user and get a yes before building.

## 3. Pick music and find the beats
- Five tracks live in `<MS>/assets/brag/music/` (credit: "Music: Sascha Ende (ende.app), CC BY 4.0"). The table of which
  track suits which tone is in `<SKILL>/vendor/brag/references/audio.md`. Each track has a beat file in
  `<MS>/assets/brag/music/cues/<stem>.music-cues.md`.
- Get cut times: `node "<SKILL>/scripts/media.mjs" beats <track-stem> --to 25 --cuts <N> --total <seconds>`. It prints beat
  times, strong cues and suggested scene lengths. Use 1 to 3 strong-cue locks, and ignore beats whenever they hurt
  readability or the story. A custom track needs `uv` and Python packages (about 200 MB): ask first, then see the beat
  section of `audio.md` (`analyze_music_cues.py` is in `<SKILL>/vendor/brag/scripts/`).
- Sound effects are in `<MS>/assets/brag/sfx/` (`ui`, `interface`, `impact`, `casino`, `keyboard`; CC0). Read
  `<MS>/assets/brag/sfx/sfx-analysis.md` for safe picks. Use 2 to 5, aligned to the START of each animation; fewer and
  better timed beats more.

## 4. Build in Remotion
1. Load the `remotion:remotion-best-practices` skill. The project is `<MS>/video` (pinned Remotion, already installed).
2. Stage assets (Remotion reads only `public/`):
   `node "<SKILL>/scripts/media.mjs" stage music/<file>.mp3 --to music` and `... stage sfx/interface/drop_001.ogg --to sfx`.
   Copy real screenshots into `<MS>/video/public/<run-slug>/`.
3. Write `brief/props.json` for the ready-made `Teaser` composition (ids: `Teaser` square, `TeaserVertical`,
   `TeaserWide`): `scenes[]` with `text`, `sub`, `seconds`, `bg`, `fg`, `accent`, optional `image`; `music`, `musicVolume`
   (about 0.85 for a music-only teaser; master it afterwards), `sfx[]` with `file`, `atSec`, `volume`; `credits`.
   Scene `seconds` come from step 3 so every cut lands on the beat.
4. Need more than text cards (real screen recordings, zooms, typing, device frames)? Add your own composition file in
   `<MS>/video/src/` and register it in `Root.tsx`; use `<OffthreadVideo>` for recordings and follow the Remotion skills.
5. Preview only if the user wants to steer live: `npx remotion studio` in `<MS>/video` (a long-running local server;
   stop it afterwards). Otherwise render directly:
   `cd "<MS>/video"` then `npx remotion render src/index.ts Teaser "<run>/work/teaser-raw.mp4" --props="<run>/brief/props.json"`.
6. Master the loudness: `node "<SKILL>/scripts/media.mjs" master "<run>/work/teaser-raw.mp4" "<run>/out/teaser.mp4"`
   (two-pass, targets -14 LUFS and a true peak of -1 dB; the video stream is copied, not re-encoded).

## 5. Check (do not skip)
- `node "<SKILL>/scripts/media.mjs" sheet "<run>/out/teaser.mp4" "<run>/work/sheet.png" --every 0.5`, then READ the sheet:
  hook in the first 2 s, every line readable and settled before the cut, nothing clipped, no muddy double exposures,
  real UI present, credits visible on the last scene.
- `node "<SKILL>/scripts/media.mjs" probe "<run>/out/teaser.mp4"`: report the true size, duration and loudness
  (aim for -14 LUFS within 1 LU, true peak at most -1 dB). A teaser is 15 to 25 s unless the user chose otherwise.
- Privacy sweep of every scene (keys, emails, home paths, customer data, employer or NDA content).
- Claude cannot hear: ask the user to play it once with sound.

## 6. Deliver
- Poster frame: pick the strongest settled frame and save it:
  `node "<SKILL>/scripts/media.mjs" ffmpeg -y -ss <seconds> -i "<run>/out/teaser.mp4" -frames:v 1 "<run>/out/poster.png"`
  (LinkedIn lets the user choose a custom thumbnail when uploading a video).
- Share copy in `out/share-copy.txt`: 1 to 3 sentences, specific, in the tone. No "excited to share". If the user has the
  LinkedIn skills, hand the files over instead (`<SKILL>/flows/linkedin.md`).
- Record it: `node "<SKILL>/scripts/media.mjs" add --run "<run>" --path "<run>/out/teaser.mp4" --kind video --alt "<what the video shows>" --credit "Music: Sascha Ende (ende.app), CC BY 4.0"`.
- Tell the user where the files are, one sentence on the creative angle, and offer to re-roll a scene or try another tone.

## Good to know
- `Teaser` is a starting point. The look (type, colours, motion) should come from the project's own brand, not defaults.
- Captions: LinkedIn plays video muted. For narrated or speech content add captions (see `demo.md`).
- Remotion is free for individuals and companies of up to 3 people; larger companies need a company licence.
