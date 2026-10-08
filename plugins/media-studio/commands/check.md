---
description: Show a readiness table for media-studio (what is installed, what is missing, what is optional)
---

Show the user whether media-studio is ready. This only reads: it installs and changes nothing.

Run `node "${CLAUDE_PLUGIN_ROOT}/skills/media-studio/scripts/check.mjs"` and show the table. (If the path text appears
unexpanded, find `media-studio/skills/media-studio/scripts/check.mjs` under the plugin folder, usually inside `~/.claude/plugins`.)

Explain it in plain words: `ok` means ready, `FAIL` means a required part is missing (suggest `/media-studio:setup`), and `skip`
means an optional part is not there (VoiceStudio for narration, uv for custom-track beat analysis, a full ffmpeg for the
website flow) and only the flows that use it are limited. If everything required is `ok`, say what they can ask for next.
