#!/usr/bin/env node
/**
 * media-studio readiness check. READ-ONLY: installs nothing, starts nothing,
 * writes nothing, never opens a .env or credential file.
 *
 *   node check.mjs            readiness table (exit 1 if a required item is missing)
 *   node check.mjs --json     the same, machine-readable
 *   node check.mjs --paths    resolved paths as JSON (workspace, video, assets, plugin, browser)
 *
 * Optional items (VoiceStudio, uv, a full system ffmpeg) never fail the run.
 */
import {
  ASSETS, PLUGIN_ROOT, RUNS, SKILL_DIR, VIDEO, WEB, WS, findBrowser, remotionCliPath,
} from "./lib/tools.mjs";
import { collectChecks, printTable } from "./lib/checks.mjs";

const args = process.argv.slice(2);

if (args.includes("--paths")) {
  const b = findBrowser();
  console.log(JSON.stringify({
    pluginRoot: PLUGIN_ROOT,
    skillDir: SKILL_DIR,
    workspace: WS,
    video: VIDEO,
    runs: RUNS,
    web: WEB,
    assets: ASSETS,
    remotionCli: remotionCliPath(),
    browser: b ? b.path : null,
    browserKind: b ? b.kind : null,
    platform: process.platform,
  }, null, 2));
  process.exit(0);
}

const rows = await collectChecks();
const ready = rows.every((r) => r.ok || r.level !== "required");
if (args.includes("--json")) {
  console.log(JSON.stringify({ workspace: WS, ready, rows }, null, 2));
} else {
  printTable(rows);
}
process.exit(ready ? 0 : 1);
