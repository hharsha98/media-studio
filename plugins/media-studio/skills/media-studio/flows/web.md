# Flow: website hero, scroll animation, landing-page visuals (scroll-craft)

**Result:** a real HTML page (or just its hero) where scrolling drives the experience, built with the vendored scroll-craft
method (MIT, by Nate Herk), then checked by scrolling it in a real browser. Replace `<SKILL>` and `<MS>` with the real paths.
The full method is `<SKILL>/vendor/scroll-craft/GUIDE.md`; read it, then `references/taste.md`, `feel.md`, `uniqueness.md`
and `verify.md`. Everything below is the media-studio wrapper around it.

## Prerequisites (this flow is the pickiest one)
- A FULL ffmpeg on the system (scroll-craft's `doctor.mjs` requires one; Remotion's bundled build is stripped).
  macOS `brew install ffmpeg`, Windows `winget install Gyan.FFmpeg`, Linux `apt install ffmpeg`. Ask before installing.
  Optional: `MEDIA_STUDIO_FFMPEG=<path>` points media-studio at it.
- Run every scroll-craft script from the workspace folder `<MS>` so `playwright-core` resolves, with
  `SCROLLCRAFT_HOME="<MS>/web"` (builds then stay out of git repositories). Point it at the browser:
  `SCROLLCRAFT_CHROME=<browser path from check.mjs --paths>` if it does not find Chrome by itself.
- Preflight: `node "<SKILL>/vendor/scroll-craft/scripts/doctor.mjs"`. Report what it finds. A missing `KIE_AI_API_KEY` is fine:
  that key is only for generating images, and building from the user's own photos and footage is a first-class route.
- Bash scripts: `encode.sh` is bash. Use `node "<SKILL>/scripts/encode.mjs" in.mp4 out.mp4 [mobile]` instead (any OS).
  Everything else in scroll-craft is Node.

## Steps (from the guide)
0. The brief: the eight questions in the guide's Step 0, answered by the user (or explicitly delegated). Write `BRIEF.md`.
1. Journey, feeling curve and the one peak. 2. Grammar, signature move, fingerprint gate, score.
3. Assets. Prefer the user's real photos, product shots and screen recordings. A hero clip can be made in Remotion
   (`<SKILL>/flows/video.md`): one continuous camera move over a real capture, no cuts, 5 to 8 s, no audio, then
   `encode.mjs` for a scrub-friendly file (and the `mobile` variant).
4. Build the page: copy `engine/scrollcraft.js` and `.css` into the build folder (never edit them), real semantic HTML.
5. Verify by scrolling: `node "<SKILL>/vendor/scroll-craft/scripts/serve.mjs" --root . --port 4500`, then `shoot.mjs` at desktop,
   `--width 390 --height 844`, and `--reduced-motion`. READ `sheet.png`, run the feel check from `references/feel.md`, and say
   plainly that no real phone was tested. `serve.mjs` listens on every network interface: stop it when done.

## Paid and third-party items (ask first, every time)
- `scripts/kie.mjs` generates images and clips with kie.ai: PAID. Use it only after the user says yes with a credit estimate
  (the guide's `references/assets.md` gives rough costs), and never pass an app screenshot as `--ref` (it uploads to a third-party host).
  It looks for its key in the environment or a `.env` file: do not open that file; tell the user where to put the key.
- Fonts or libraries from a CDN need the network when the page loads: say so.

## Deliver
Report the build folder, the local URL, what was verified (and what was not: a real phone, real network speed), and the
brief's status (interviewed or self-authored). Append the build to `<MS>/web/FINGERPRINTS.md` as the guide says.
