import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { resolveToken, startHttpServer, tokenFilePath } from "../http.js";
import { createServer } from "../server.js";

const TOKEN = "test-token-0123456789abcdef";

/** Plain request with full control over headers; returns status, headers and body text. */
function request(url: string, opts: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request(url, { method: opts.method ?? "POST", headers: opts.headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end(opts.body);
  });
}

const initBody = JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } },
});
const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

test("http: missing or wrong key gives 401", async () => {
  const s = await startHttpServer({ port: 0, host: "127.0.0.1", token: TOKEN });
  try {
    const none = await request(s.url, { headers: jsonHeaders, body: initBody });
    assert.equal(none.status, 401);
    assert.equal(none.headers["www-authenticate"], "Bearer");
    const wrong = await request(s.url, { headers: { ...jsonHeaders, Authorization: "Bearer wrong-token-0123456789" }, body: initBody });
    assert.equal(wrong.status, 401);
  } finally {
    await s.close();
  }
});

test("http: wrong Host header gives 403", async () => {
  const s = await startHttpServer({ port: 0, host: "127.0.0.1", token: TOKEN });
  try {
    const r = await request(s.url, { headers: { ...jsonHeaders, host: "evil.example:80", Authorization: `Bearer ${TOKEN}` }, body: initBody });
    assert.equal(r.status, 403);
  } finally {
    await s.close();
  }
});

test("http: GET and DELETE on /mcp give 405", async () => {
  const s = await startHttpServer({ port: 0, host: "127.0.0.1", token: TOKEN });
  try {
    for (const method of ["GET", "DELETE"]) {
      const r = await request(s.url, { method, headers: { Authorization: `Bearer ${TOKEN}` } });
      assert.equal(r.status, 405);
    }
  } finally {
    await s.close();
  }
});

test("http: /health works without a key", async () => {
  const s = await startHttpServer({ port: 0, host: "127.0.0.1", token: TOKEN });
  try {
    const r = await request(s.url.replace(/\/mcp$/, "/health"), { method: "GET" });
    assert.equal(r.status, 200);
    const b = JSON.parse(r.body);
    assert.equal(b.ok, true);
    assert.equal(b.name, "media-studio-mcp");
    assert.equal(typeof b.version, "string");
  } finally {
    await s.close();
  }
});

test("http: a real client with the key lists the same tools as createServer()", async () => {
  const s = await startHttpServer({ port: 0, host: "127.0.0.1", token: TOKEN });
  const client = new Client({ name: "test", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(s.url), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }));
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    const expected = Object.keys((createServer() as any)._registeredTools).sort();
    assert.equal(names.length, 9);
    assert.deepEqual(names, expected);
  } finally {
    await client.close();
    await s.close();
  }
});

test("http: refuses to listen on a non-loopback host", async () => {
  await assert.rejects(startHttpServer({ port: 0, host: "0.0.0.0", token: TOKEN }), /refusing to listen/);
});

test("http: key file is created with 64 hex chars and mode 0600", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ms-mcp-"));
  const oldHome = process.env.MEDIA_STUDIO_HOME;
  const oldTok = process.env.MEDIA_STUDIO_MCP_TOKEN;
  process.env.MEDIA_STUDIO_HOME = path.join(home, "nested");
  delete process.env.MEDIA_STUDIO_MCP_TOKEN;
  try {
    const token = resolveToken();
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(fs.readFileSync(tokenFilePath(), "utf8"), token);
    assert.equal(fs.statSync(tokenFilePath()).mode & 0o777, 0o600);
    assert.equal(resolveToken(), token); // second call reuses the file
  } finally {
    if (oldHome === undefined) delete process.env.MEDIA_STUDIO_HOME; else process.env.MEDIA_STUDIO_HOME = oldHome;
    if (oldTok !== undefined) process.env.MEDIA_STUDIO_MCP_TOKEN = oldTok;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("http: a too-short key from the environment is refused", () => {
  const old = process.env.MEDIA_STUDIO_MCP_TOKEN;
  process.env.MEDIA_STUDIO_MCP_TOKEN = "short";
  try {
    assert.throws(() => resolveToken(), /at least 16/);
  } finally {
    if (old === undefined) delete process.env.MEDIA_STUDIO_MCP_TOKEN; else process.env.MEDIA_STUDIO_MCP_TOKEN = old;
  }
});
