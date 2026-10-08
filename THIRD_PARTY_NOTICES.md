# Third-party notices

media-studio's own files are MIT (see `LICENSE`). This page lists everything else: what is copied into this repository
(vendored), what is only downloaded when you run setup, and what is only referenced. Read 2026-10-08.

## Vendored into this repository (MIT text, each with its licence file)

### brag (teaser method)
- Source: https://github.com/latent-spaces/brag, commit `cb89b9f44309b0bf4e3cb89e685fadf80c7999ed` (2026-10-01).
- Licence: MIT, Copyright (c) 2026 Shunit Haviv Hakimi. Full text: `plugins/media-studio/skills/media-studio/vendor/brag/LICENSE`.
- Copied: `skills/brag/SKILL.md` (as `GUIDE.md`), `skills/brag/slim.md`, `skills/brag/references/*.md` (6 files),
  `skills/brag/scripts/` (`analyze_music_cues.py`, `pyproject.toml`, `uv.lock`). `skills/brag-slim/SKILL.md` is byte-identical to
  `slim.md`, so only one copy is kept.
- NOT copied: everything under `skills/brag/assets/` (music, beat files, sound effects). See "Downloaded by setup".
- Edits (all of them): (1) `SKILL.md` renamed `GUIDE.md` so it does not register as a separate skill; (2) one "media-studio
  vendoring note" paragraph added under the front matter of `GUIDE.md` and `slim.md`; (3) the file name `SKILL.md` replaced by
  `GUIDE.md` in `GUIDE.md` (1 line), `references/audio.md` (1 line) and `references/step-3-compose.md` (1 line);
  (4) in `references/audio.md` the example home-folder path in the sentence "Never use absolute paths" now reads "starting with `/` or a drive letter".

### scroll-craft (website craft)
- Source: an installed copy of the `scroll-craft` skill (its CHANGELOG calls the plugin `nateherk-design`). The upstream
  repository URL was not recorded; confirm it before publishing.
- Licence: MIT, Copyright (c) 2026 Nate Herk. Full text: `plugins/media-studio/skills/media-studio/vendor/scroll-craft/LICENSE`.
- Copied: the whole skill folder (`GUIDE.md`, `CHANGELOG.md`, `LICENSE`, `engine/`, `references/`, `scripts/`, `templates/`). Its tool-permission
  front-matter line (the one that pre-approves shell commands) had already been removed before it was copied.
- Edits (all of them): (1) `SKILL.md` renamed `GUIDE.md`; (2) a "media-studio vendoring note" paragraph under the front matter;
  (3) the file name `SKILL.md` replaced by `GUIDE.md` in `references/assets.md`, `feel.md`, `devices.md`, `uniqueness.md` and `template.html`.
  Scripts are unchanged (`encode.sh` is bash; `scripts/encode.mjs` in media-studio is our Node port).
- `scripts/kie.mjs` calls a paid third-party service (kie.ai). It is shipped as-is and is never run without the user's yes.

## Downloaded by `setup.mjs` (not stored in this repository)
Fetched from the pinned commit above, `https://raw.githubusercontent.com/latent-spaces/brag/cb89b9f44309b0bf4e3cb89e685fadf80c7999ed/skills/brag/assets/`,
and rejected unless the SHA-256 matches `plugins/media-studio/skills/media-studio/assets-manifest.json`.
- **Music** (5 tracks, "Happy Beats / Business Moves", vol. 1, 9, 10, 11, 12): Sascha Ende, https://ende.app/en. Licence CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/); the site states everything on it is CC BY 4.0, commercial use allowed.
  Credit line to keep in anything published: **Music: Sascha Ende (ende.app), CC BY 4.0**.
- **Beat files and the SFX guide** (12 small text files): produced by the brag project's analysis script; MIT with that project.
- **Sound effects** (260 files): Kenney (https://kenney.nl) CC0, and the keyboard set "Keyboard Soundpack #1" by unicae_games
  (https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes) CC0.

## Installed by npm at setup (pinned in `templates/remotion/package.json` and its lockfile)
- **Remotion** 4.0.534 (`remotion`, `@remotion/cli`, `@remotion/media`) and its Chrome Headless Shell download. The Remotion
  library has its own licence, https://github.com/remotion-dev/remotion/blob/main/LICENSE.md. In short: free for an individual, a
  for-profit organisation with up to 3 employees, a non-profit, or evaluation; larger for-profit companies need a company licence
  (https://www.remotion.pro/license). Remotion's licence also forbids selling or sub-licensing a derivative of Remotion itself.
- React, React DOM, TypeScript, `@types/react` and `playwright-core` keep their own licences (see each package on npm).

## Referenced, not copied
- **Remotion agent skills**, https://github.com/remotion-dev/claude-code-plugin, pinned to commit
  `ce2654df2ddcf41f3b2695693be7b3a0a05c6bc5` in `.claude-plugin/marketplace.json`. Not vendored: that repository has no LICENSE file
  (its `plugin.json` says `"license": "MIT"`), so redistribution is left to the upstream repository. Users install it from there
  as a plugin dependency.
- **VoiceStudio**, https://github.com/debpalash/VoiceStudio (AGPL-3.0 for the application). Not bundled, not vendored and none of its
  text is copied: `flows/voice.md` is our own summary of its public HTTP API. The user installs and runs it themselves.
- **Publora** public API documentation (https://docs.publora.com) and **LinkedIn** help and developer documentation: facts only,
  with sources and dates in `flows/linkedin.md`. No text or code copied.
- The LinkedIn skills plugin (`linkedin-skills`) is read-only context for `flows/linkedin.md`; nothing from it is copied.
