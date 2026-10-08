# Flow: narrated demo of a real app (60 to 90 s) plus a 30 s vertical cut

**Result:** a 16:9 demo video (1920x1080, 60 to 90 s) and a vertical cut (1080x1920, 30 s or less), built from REAL captures
of the running app, with narration (or captions only), music ducked under the voice, and an end card with a real link.
Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md). Nothing is posted or published by this flow.

## Honesty rules (they decide every step)
- Real app, real data. No mock screens, no div-built UI, no generated UI, no stand-ins. Hide private data by blur or crop.
- Label recordings on screen: "Screen recording, <app> v<version>", plus "AI voice" and the music credit where they apply.
- True durations. Any trim or speed-up gets a label ("2x", "40 s wait cut"); any time claim must match the capture log.
- No invented numbers, counters, costs, users or benchmarks unless the app shows them in the capture.
- Show only features that work in the build you captured.

## 1. Brief and script (get the user's yes before capturing)
- `brief/brief.md`: audience, the one thing viewers must believe, ONE real call-to-action link, only features that work today.
- `brief/script.md`: numbered lines, one per caption, 150 to 220 words for 60 to 90 s (about 2.5 words a second).
- `brief/storyboard.md`: each line mapped to a scene, shot and zoom target.

## 2. Capture
- **Web app:** ask the user to start it (never guess the run command; read the README for it) in a clean demo workspace
  with real, non-sensitive data. Record with Playwright using the installed browser: write `capture/capture.mjs` that
  does `const { chromium } = createRequire("<MS>/package.json")("playwright-core")`, launches
  `executablePath` from `node "<SKILL>/scripts/check.mjs" --paths` (field `browser`), a 1920x1080 viewport and
  `recordVideo: { dir, size: { width: 1920, height: 1080 } }`, then performs the real steps with short pauses.
  Rehearse first without recording. Take 2x stills (viewport 1440x900, `deviceScaleFactor: 2`) for small text.
- **Desktop app or phone:** the user records the window with their system recorder (macOS Cmd+Shift+5; Windows Win+Shift+R
  or Xbox Game Bar Win+G; Linux OBS or the desktop's recorder). You never need their passwords.
- Never record key, token or sign-in screens unless the app itself masks the secret.
- Convert each clip to MP4: `node "<SKILL>/scripts/media.mjs" ffmpeg -y -i raw.webm -r 30 -c:v libx264 -crf 16 -pix_fmt yuv420p capture/clip-01.mp4`.
- Write `capture/CAPTURE-LOG.md`: date, app version and commit, URL or surface, each clip's real length, every trim or speed-up.

## 3. Narration
Follow `<SKILL>/flows/voice.md`: one WAV per script line, text identical to the caption. Check each file with
`media.mjs probe` (real audio, real duration). No narration? Ship captions only; LinkedIn plays muted anyway.

## 4. Compose in Remotion
1. Load `remotion:remotion-best-practices` and `remotion:remotion-captions`. Read the voiceover guide in
   `remotion:remotion-markup` but use your own WAV files (never ask for an ElevenLabs or other paid key).
2. Stage everything in `<MS>/video/public/<run-slug>/` (clips, 2x stills, `voiceover/line-NN.wav`, music via `media.mjs stage`).
3. Two compositions, 30 fps: `<slug>-16x9` (1920x1080) and `<slug>-9x16-30s` (1080x1920, 30 s or less, a subset of the
   lines that still tells the story). `calculateMetadata` sizes each scene to its audio.
4. Scenes: title card (product and promise, 2 to 3 s); UI scenes (`<OffthreadVideo>` clips or 2x stills) with spring zooms to the
   storyboard target; captions from `script.md` timed by the audio (at most 2 lines of about 42 characters, larger on 9:16 and
   away from LinkedIn's on-video buttons); end card with the real link, the labels and the credits.
5. Music: one bundled track (`media.mjs stage music/<file>.mp3 --to music`), volume about 0.15 under speech.
6. Render: `npx remotion render src/index.ts <slug>-16x9 "<run>/work/demo-raw.mp4"` (and the vertical one), then
   `media.mjs master` each to `<run>/out/` (target -14 LUFS, true peak at most -1 dB).

## 5. Checks before delivery
1. `media.mjs sheet` (use `--every 2` for the long one, `--every 1` for the 30 s cut) and read it.
2. `media.mjs probe`: 1920x1080 at 60 to 90 s, 1080x1920 at 30 s or less. Report the real durations.
3. Loudness within 1 LU of -14 LUFS, true peak at most -1 dB.
4. Captions match narration: transcribe the final audio (VoiceStudio `/v1/audio/transcriptions` with `response_format=srt`, see
   `voice.md`), diff it with `script.md`, regenerate any line that differs.
5. Privacy sweep of every frame (keys, tokens, emails, home paths, hostnames, employer or NDA content).
6. Labels, credits and the AI-voice note are present; the call-to-action link works.
7. Ask the user to watch each render once with sound (Claude cannot hear).
8. Deliver paths, true durations, alt text, `media.json` (`linkedin.md`). Never post or schedule.
