// End-to-end test: spawns the server over stdio, researches, validates, renders and prints the report.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(new StdioClientTransport({ command: "node", args: [path.join(root, "dist", "index.js")], stderr: "inherit" }));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find((c) => c.type === "text")?.text ?? "";
  let data; try { data = JSON.parse(t); } catch { data = t; }
  return { r, data };
};

console.log("tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));
console.log("prompts:", (await client.listPrompts()).prompts.map((p) => p.name).join(", "));
const setup = await call("check_setup");
console.log("ready_to_render:", setup.data.ready_to_render, "| voice:", setup.data.voicestudio?.engine, "| asr:", setup.data.asr?.available);
if (!setup.data.ready_to_render) { console.log(JSON.stringify(setup.data, null, 2)); process.exit(1); }

const research = [];
for (const topic of ["Day-ahead market", "Solar power"]) {
  const { data } = await call("research_topic", { topic, max_sources: 2 });
  console.log(`research "${topic}": ${data.sources?.length} sources, ${data.facts?.length} facts`);
  research.push(data);
}
const sources = [
  research[0].sources?.[0] && { ...research[0].sources[0], id: "s1" },
  research[1].sources?.[0] && { ...research[1].sources[0], id: "s2" },
].filter(Boolean);
const plan = {
  title: "Solar power on the day-ahead market",
  description: "A 25-second explainer on how solar power is traded on the day-ahead electricity market",
  audience: "curious non-experts",
  style: "explainer", language: "en", length_seconds: 25, format: "16:9", author: "agent",
  sources,
  scenes: [
    { id: "sc1", kind: "title", heading: "Selling solar power a day ahead", subtitle: "How the day-ahead electricity market works", narration: "How is solar power sold a day ahead?" },
    { id: "sc2", kind: "steps", heading: "The day-ahead auction", items: ["Bids are sent the day before", "An auction matches supply and demand", "One clearing price for each period"],
      narration: "Bids are submitted the day before delivery. An auction matches supply and demand for each hour of the next day, at a single clearing price.", source_ids: ["s1"] },
    { id: "sc3", kind: "bullets", heading: "What solar producers do", items: ["Check the weather forecast", "Estimate output for each hour", "Bid at a very low price"],
      narration: "Solar producers bid using weather forecasts.", source_ids: ["s2"] },
    { id: "sc4", kind: "compare", heading: "Why midday prices dip",
      left: { heading: "Sunny midday", items: ["Lots of solar offered", "Low marginal cost", "Price pushed down"] },
      right: { heading: "Evening", items: ["Solar output fades", "Other plants set the price"] },
      narration: "With low marginal cost, solar pushes prices down at midday." , source_ids: ["s1", "s2"] },
    { id: "sc5", kind: "end", narration: "" },
  ],
};
const v = await call("validate_plan", { plan });
console.log("validate:", JSON.stringify(v.data));
if (!v.data.ok) process.exit(1);
const job = await call("render_video", { plan });
console.log("render_video:", JSON.stringify(job.data));
const id = job.data.job_id;
let last = "";
for (;;) {
  const { r, data } = await call("get_job", { job_id: id, wait_seconds: 45 });
  const line = typeof data === "object" ? `${data.state}/${data.step} ${data.progress_percent}%` : String(data);
  if (line !== last) console.log("get_job:", line);
  last = line;
  if (data.state === "done" || data.state === "failed") {
    console.log("images returned:", r.content.filter((c) => c.type === "image").map((c) => `${Math.round(c.data.length * 0.75 / 1024)} KB`).join(", ") || "none");
    if (data.error) console.log("error:", data.error);
    console.log("\n" + (data.report_md ?? ""));
    console.log("video:", data.video_path, "\nrun_dir:", data.run_dir);
    break;
  }
}
console.log("list_runs:", JSON.stringify((await call("list_runs", { limit: 2 })).data));
await client.close();
