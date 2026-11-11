#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./config.js";
import { DEFAULT_HOST, DEFAULT_PORT, resolveToken, startHttpServer, tokenFilePath } from "./http.js";
import { createServer } from "./server.js";

const HELP = `media-studio-mcp: MCP server for short videos with a neutral run report.

Usage:
  media-studio-mcp                      stdio mode (Claude Code, Codex, Cursor, Gemini CLI)
  media-studio-mcp --http [options]     HTTP mode for apps that only accept a URL

HTTP options:
  --port <number>   port to listen on (default ${DEFAULT_PORT}, or env MEDIA_STUDIO_MCP_PORT)
  --host <name>     127.0.0.1, ::1 or localhost only (default ${DEFAULT_HOST})

HTTP mode needs a key. It uses env MEDIA_STUDIO_MCP_TOKEN (16+ characters) or the file
<MEDIA_STUDIO_HOME>/mcp-token, which is created on first start. Clients send
"Authorization: Bearer <key>" to http://<host>:<port>/mcp.

  -h, --help        show this text
`;

/** Reads "--name value" from the arguments. */
function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function runHttp(args: string[]): Promise<void> {
  const port = Number(flagValue(args, "--port") ?? process.env.MEDIA_STUDIO_MCP_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`bad port: ${port}`);
  const host = flagValue(args, "--host") ?? DEFAULT_HOST;
  const handle = await startHttpServer({ port, host, token: resolveToken() });
  log(`ready (http) at ${handle.url}`);
  log(`key file: ${tokenFilePath()}`);
  log(`copy the key with: pbcopy < ${tokenFilePath()}`);
  const stop = () => {
    handle.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("--http")) return runHttp(args);
  await createServer().connect(new StdioServerTransport());
  log("ready (stdio)");
}

main().catch((e) => {
  log(`failed to start: ${(e as Error).message}`);
  process.exit(1);
});
