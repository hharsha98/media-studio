import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { msHome } from "./config.js";
import { SERVER_NAME, SERVER_VERSION, createServer } from "./server.js";

export const DEFAULT_PORT = 8095;
export const DEFAULT_HOST = "127.0.0.1";
const LOOPBACK_HOSTS = ["127.0.0.1", "::1", "localhost"];
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export const tokenFilePath = () => path.join(msHome(), "mcp-token");

/** The key: env MEDIA_STUDIO_MCP_TOKEN if set, else the key file (created on first use, private to this user). */
export function resolveToken(): string {
  const fromEnv = process.env.MEDIA_STUDIO_MCP_TOKEN;
  if (fromEnv) {
    if (fromEnv.length < 16) throw new Error("MEDIA_STUDIO_MCP_TOKEN must be at least 16 characters");
    return fromEnv;
  }
  const file = tokenFilePath();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  const token = fs.readFileSync(file, "utf8").trim();
  if (token.length < 16) throw new Error(`key in ${file} is shorter than 16 characters; delete the file to make a new one`);
  return token;
}

/** Constant-time comparison; different lengths are simply "no". */
function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: http.OutgoingHttpHeaders = {}): void {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const rpcError = (code: number, message: string) => ({ jsonrpc: "2.0", error: { code, message }, id: null });

class BodyTooLarge extends Error {}

/** Reads the request body as JSON, refusing anything over 4 MB. */
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLarge());
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new SyntaxError("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** One POST = one fresh server and transport (stateless). Jobs live in a shared module-level store, so nothing is lost. */
async function handleMcpPost(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    if (e instanceof BodyTooLarge) return sendJson(res, 413, rpcError(-32000, "request body too large (max 4 MB)"), { Connection: "close" });
    return sendJson(res, 400, rpcError(-32700, "parse error"));
  }
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch {
    sendJson(res, 500, rpcError(-32603, "internal server error"));
  }
}

export async function startHttpServer(opts: { port: number; host: string; token: string }): Promise<{ url: string; close(): Promise<void> }> {
  const { host, token } = opts;
  if (!LOOPBACK_HOSTS.includes(host)) throw new Error(`refusing to listen on "${host}": use 127.0.0.1, ::1 or localhost (this Mac only)`);
  if (token.length < 16) throw new Error("the key must be at least 16 characters");

  let port = opts.port;
  const allowedHosts = () => LOOPBACK_HOSTS.map((h) => `${h.includes(":") ? `[${h}]` : h}:${port}`);

  const httpServer = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname === "/health" && req.method === "GET") {
        return sendJson(res, 200, { ok: true, name: SERVER_NAME, version: SERVER_VERSION });
      }
      if (pathname !== "/mcp") return sendJson(res, 404, { error: "not found" });
      // Guard against DNS rebinding: only our own loopback names are accepted.
      if (!allowedHosts().includes((req.headers.host ?? "").toLowerCase())) {
        return sendJson(res, 403, rpcError(-32000, "forbidden host"));
      }
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ") || !tokenMatches(auth.slice(7).trim(), token)) {
        return sendJson(res, 401, rpcError(-32001, "unauthorized: send Authorization: Bearer <key>"), { "WWW-Authenticate": "Bearer" });
      }
      if (req.method === "POST") return await handleMcpPost(req, res);
      return sendJson(res, 405, rpcError(-32000, "method not allowed"), { Allow: "POST" });
    } catch {
      sendJson(res, 500, rpcError(-32603, "internal server error"));
    }
  });
  // get_job can wait up to 50 s: never cut a request short.
  httpServer.requestTimeout = 0;
  httpServer.headersTimeout = 60_000;
  httpServer.timeout = 0;
  httpServer.keepAliveTimeout = 120_000;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(opts.port, host, () => resolve());
  });
  port = (httpServer.address() as AddressInfo).port;
  const shownHost = host.includes(":") ? `[${host}]` : host;
  return {
    url: `http://${shownHost}:${port}/mcp`,
    close: () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeAllConnections();
      }),
  };
}
