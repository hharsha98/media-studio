# Flow: setup, check and troubleshooting

Run through `/media-studio:setup` (installs) and `/media-studio:check` (read-only report). Both run Node scripts that work
on macOS, Windows and Linux and need only Node 18 or newer. Nothing is installed globally: everything lives in one workspace
folder (default `~/MediaStudio`; set `MEDIA_STUDIO_HOME` to move it).

## What setup puts in the workspace, and how big it is
| Step | What | Size | Where it comes from |
|---|---|---|---|
| playwright-core | drives your installed Chrome or Edge for still images (downloads NO browser) | about 13 MB | npm |
| Remotion project | the pinned video project (exact versions, with a lockfile) | about 250 MB on disk | npm, from `templates/remotion/` in this plugin |
| Chrome Headless Shell | the browser Remotion renders with | about 171 MB download, about 570 MB on disk | Remotion's own download (`npx remotion browser ensure`) |
| Browser for stills | uses your Chrome, Edge or Chromium; else Remotion's shell; only if neither exists, offers Playwright's headless Chromium (about 100 MB) | 0 | your computer |
| Music | 5 tracks by Sascha Ende (CC BY 4.0) | 12.4 MB | the pinned upstream commit of `latent-spaces/brag`, SHA-256 checked |
| Beat files | beat grids for those tracks, plus the sound-effects guide | 0.7 MB | same |
| Sound effects | 260 short UI, impact, casino and keyboard sounds (CC0) | 2.5 MB | same |

Total about 0.9 GB of disk. Every download is announced with its size and needs a yes (the user can say yes to all
with `--yes`). A file that fails its SHA-256 check is deleted and reported, never kept.

## Run it
1. `node "<SKILL>/scripts/check.mjs"` shows what is missing.
2. Tell the user in plain words what will be installed and the sizes above, and get one clear yes.
3. `node "<SKILL>/scripts/setup.mjs" --yes` (add `--no-sfx` to skip the sound effects). It takes a few minutes. It is safe to
   re-run: finished steps are skipped. Exit codes: 0 ready, 1 a step failed, 2 waiting for approval.
4. `node "<SKILL>/scripts/check.mjs"` again. Required rows must say `ok`. "skip" rows are optional (VoiceStudio, uv, a full ffmpeg).

## Platform notes
- **macOS:** nothing extra. Chrome is used for stills if installed; otherwise Remotion's shell.
- **Windows:** install Node 18+ from https://nodejs.org. Use PowerShell or Git Bash; the Node tools are the same. Quote paths that
  contain spaces. `encode.sh` is replaced by `encode.mjs`.
- **Linux:** Remotion's Chrome Headless Shell needs system libraries (nss, atk, cups and others). If rendering fails with a
  missing `.so` file, follow https://www.remotion.dev/docs/miscellaneous/linux-dependencies (a package install: ask first).
- **Behind a proxy or offline:** the Remotion browser download and the asset downloads need the internet. Set the usual
  `HTTPS_PROXY`, or run setup on a connected machine and copy the workspace folder.
- **Upgrading Remotion:** versions are pinned on purpose. To upgrade, update the plugin, then `setup.mjs --only=remotion --refresh-template`
  refreshes the source files; change package versions deliberately and re-run the smoke checks.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `check.mjs` shows FAIL for Remotion or the browser | run `/media-studio:setup` |
| `npm` errors during setup | check the network and the Node version (`node -v`, 18 or newer), then re-run |
| Render says it cannot find a browser | `cd "<MS>/video"` then `npx remotion browser ensure` |
| `still.mjs` says no browser | install Chrome or Edge, or run setup; or set `MEDIA_STUDIO_CHROME` to a browser executable |
| A music file fails its hash check | re-run setup; if it repeats, the upstream file changed: report it, do not use the file |
| VoiceStudio shows "skip" | optional; see `voice.md` |

## Remove everything
Delete the workspace folder, and `/plugin uninstall media-studio@media-studio-marketplace`. Nothing else was changed.
