import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The package root: works from dist/ (compiled) and src/ alike. */
export const PACKAGE_ROOT = path.resolve(here, "..");

export function msHome(): string {
  return process.env.MEDIA_STUDIO_HOME || path.join(os.homedir(), "MediaStudio");
}
export const videoProject = () => path.join(msHome(), "video");
export const runsDir = () => path.join(msHome(), "runs");
export const musicDir = () => path.join(msHome(), "assets", "brag", "music");
export const voiceStudioUrl = () => (process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900").replace(/\/$/, "");
export const remotionSource = () => path.join(PACKAGE_ROOT, "remotion");
export const remotionTarget = () => path.join(videoProject(), "src", "media-studio-mcp");

/** Folder with media.mjs: env override, else the plugin folder next to this package (repo layout). */
export function scriptsDir(): string {
  return (
    process.env.MEDIA_STUDIO_SCRIPTS ||
    path.resolve(PACKAGE_ROOT, "..", "plugins", "media-studio", "skills", "media-studio", "scripts")
  );
}
export const mediaScript = () => path.join(scriptsDir(), "media.mjs");

export const MUSIC_CREDIT = "Music: Sascha Ende (ende.app), CC BY 4.0";
export const USER_AGENT = "media-studio-mcp/0.1 (https://github.com/hharsha98/media-studio)";

/** Everything that goes to stderr; stdout belongs to the MCP protocol. */
export function log(...args: unknown[]): void {
  process.stderr.write(`[media-studio-mcp] ${args.map(String).join(" ")}\n`);
}
