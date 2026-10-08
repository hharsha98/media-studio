---
description: Install what media-studio needs (Remotion project, browser, music), asking before each download
argument-hint: "[--no-sfx] [--only=remotion,assets]"
---

Set up media-studio on this computer. The user may be new to video and to the terminal, so explain each step in plain words.

The skill folder is `${CLAUDE_PLUGIN_ROOT}/skills/media-studio`. (If that text appears unexpanded, find
`media-studio/skills/media-studio/scripts/setup.mjs` under the plugin folder, usually inside `~/.claude/plugins`.)

1. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/media-studio/scripts/check.mjs" --paths` to learn the workspace folder, then
   `node "${CLAUDE_PLUGIN_ROOT}/skills/media-studio/scripts/check.mjs"` to see what is already there.
2. Tell the user, in a short list, what setup will put in that folder and how big each part is: playwright-core about 13 MB;
   the Remotion video project about 250 MB; Remotion's Chrome Headless Shell about 171 MB to download (about 570 MB on disk);
   music 12.4 MB, beat files 0.7 MB and sound effects 2.5 MB downloaded from the pinned upstream commit and hash-checked.
   About 0.9 GB in total, nothing installed globally. Skip parts that are already done.
3. Ask ONE clear yes or no question: "Install these into <workspace folder>?". Wait for the answer. If they want to skip the
   sound effects, use `--no-sfx`.
4. On yes, run `node "${CLAUDE_PLUGIN_ROOT}/skills/media-studio/scripts/setup.mjs" --yes $ARGUMENTS`. It takes a few minutes
   (run it so the output is visible, and allow a long timeout). It is safe to re-run.
5. If it exits with 1 (a step failed) read the message, explain it plainly, and follow the troubleshooting table in
   `${CLAUDE_PLUGIN_ROOT}/skills/media-studio/flows/setup.md`. Exit code 2 means it is waiting for approval of a download.
6. Finish by running the check again and showing the readiness table. Required rows should say `ok`; "skip" rows are optional.
   Then tell the user what they can ask for next (a launch teaser, a social card, a carousel, a narrated demo, a website hero).
