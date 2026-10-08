# Plugin format this repository follows

Checked on 2026-10-08 against the official Claude Code documentation and against Claude Code 2.1.281
(`claude plugin validate . --strict` passes for the marketplace, the plugin, `skills/` and `commands/`).

## Documentation used
- https://code.claude.com/docs/en/plugins (overview)
- https://code.claude.com/docs/en/plugins-reference (manifest reference)
- https://code.claude.com/docs/en/plugin-marketplaces (create a marketplace)
- https://code.claude.com/docs/en/plugins/manifest-reference (fields, standard layout, environment variables)
- https://code.claude.com/docs/en/plugins/marketplace-reference (marketplace fields, plugin sources)
- https://code.claude.com/docs/en/plugins/dependencies (plugin dependencies)
- https://code.claude.com/docs/en/plugins/cli-reference (`claude plugin install`, `marketplace add`, `validate`)
- https://code.claude.com/docs/en/plugins/create (`--plugin-dir`, testing)
- https://code.claude.com/docs/en/plugins/loading (cache layout, name conflicts)
- https://code.claude.com/docs/en/plugins/install and https://code.claude.com/docs/en/discover-plugins (installing)
- https://code.claude.com/docs/en/skills (string substitutions in skills)

## What the docs say, and what this repo does
- **Layout.** `.claude-plugin/plugin.json` (only `name` is required), `skills/<name>/SKILL.md`, `commands/*.md` (flat command
  files; the docs prefer skills for new plugins, and a plugin command shows up as a skill: `claude plugin details` lists
  `check, media-studio, setup`). Components live at the plugin root, never inside `.claude-plugin/`.
  Here the plugin sits in `plugins/media-studio/` and the marketplace file is at the repo root, which is the documented
  "relative path" source (`"source": "./plugins/media-studio"`).
- **Names.** Plugin skills and commands are namespaced by the plugin name: `/media-studio:setup`, `/media-studio:check`. The
  marketplace entry name equals the manifest name (`media-studio`) as the docs require. Marketplace name:
  `media-studio-marketplace`, so the install id is `media-studio@media-studio-marketplace`.
- **Paths.** `${CLAUDE_PLUGIN_ROOT}` (the installed version's folder; it changes on every update, so no state is written there)
  and `${CLAUDE_SKILL_DIR}` are substituted inside a plugin skill's markdown (SKILL.md and the commands). They are NOT
  substituted in other files Claude reads later (the flow files), so SKILL.md prints the resolved paths and the flows use
  `<SKILL>` and `<MS>` placeholders. All scripts find their own folder through `import.meta.url`. User data (the workspace)
  lives outside the plugin, in `~/MediaStudio`.
- **Pointing at another GitHub repo.** A marketplace entry CAN: `source` accepts `github` (`repo`), `url` (any git URL) and
  `git-subdir`, each with `ref` and a full 40-character `sha`. This repo lists the official Remotion plugin
  (`remotion-dev/claude-code-plugin`) pinned to the audited commit `ce2654df2ddcf41f3b2695693be7b3a0a05c6bc5`.
  Finding: the `github` form clones over SSH and failed on a machine without a known `github.com` host key
  ("Host key verification failed"). The `url` form with `https://github.com/remotion-dev/claude-code-plugin.git` clones over
  HTTPS, installed fine, and is what this repo uses.
- **Dependencies.** `plugin.json` declares `"dependencies": ["remotion"]`; a bare name is looked up in the same marketplace, so
  installing media-studio installs the pinned Remotion plugin too (verified: both showed `enabled`). Without the dependency
  media-studio showed `failed to load`.
- **Install commands for a user:** `/plugin marketplace add hharsha98/media-studio` then
  `/plugin install media-studio@media-studio-marketplace` (or `claude plugin marketplace add ...` and `claude plugin install ...`
  in a shell). The marketplace must be added before the install.
- **Test locally from a folder:** `claude plugin marketplace add ./path/to/media-studio` (a directory source is read in place),
  then `claude plugin install media-studio@media-studio-marketplace`. `claude --plugin-dir ./plugins/media-studio` loads one plugin
  for one session (point it at the plugin root, not the marketplace root; it will not install dependencies for you).
- **Validate:** `claude plugin validate <path> [--strict]` (marketplace, plugin, or a `skills`/`commands` folder).
- **No tool pre-approval** in any front matter: every shell command asks for the user's normal permission.

## Verified in a live session
- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` expand to absolute paths inside both `SKILL.md` and the commands: after a local
  install, invoking `/media-studio:check` and `/media-studio:media-studio` through the Skill tool printed fully expanded paths.
- After the local install `claude plugin details media-studio` lists skills `check, media-studio, setup` and
  `claude plugin details remotion` lists the 12 Remotion skills at version 4.0.532 (the pinned commit).

## Not verified
- Installing from GitHub (`owner/repo`) rather than a local folder: the repository has not been pushed. For a git-hosted marketplace the plugin is
  copied into Claude Code's plugin cache, so every script finds its own folder with `import.meta.url` and keeps data in the workspace.
- Windows and Linux behaviour.
