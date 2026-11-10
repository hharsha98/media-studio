import { randomUUID } from "node:crypto";

export interface TraceStep {
  name: string;
  seconds: number;
  startedAt: number; // epoch ms
}

export function tracingConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_HOST);
}

/** One trace per job, one span per step, via the Langfuse ingestion API. Never throws; returns a status text. */
export async function sendTrace(runId: string, input: unknown, steps: TraceStep[], state: string): Promise<string> {
  if (!tracingConfigured()) return "not configured (set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_HOST to enable)";
  try {
    const host = process.env.LANGFUSE_HOST!.replace(/\/$/, "");
    const auth = Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString("base64");
    const traceId = randomUUID();
    const now = () => new Date().toISOString();
    const batch: unknown[] = [
      { id: randomUUID(), type: "trace-create", timestamp: now(), body: { id: traceId, name: "media-studio-mcp render", input, metadata: { run_id: runId, state } } },
      ...steps.map((s) => ({
        id: randomUUID(),
        type: "span-create",
        timestamp: now(),
        body: { id: randomUUID(), traceId, name: s.name, startTime: new Date(s.startedAt).toISOString(), endTime: new Date(s.startedAt + s.seconds * 1000).toISOString() },
      })),
    ];
    const res = await fetch(`${host}/api/public/ingestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok || res.status === 207 ? `sent (trace ${traceId}, HTTP ${res.status})` : `failed: HTTP ${res.status}`;
  } catch (e) {
    return `failed: ${(e as Error).message}`;
  }
}
