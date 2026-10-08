#!/usr/bin/env node
/**
 * Look at a website the way a visitor does, and save real material for a teaser or card.
 *
 *   node capture.mjs <url> --out <folder> [--width 1440] [--height 900] [--scale 2] [--max 8]
 *
 * It loads the page in your browser (so JavaScript sites render), scrolls down one screen at a
 * time taking a screenshot of each, and writes page-info.json with the title, description,
 * headings, buttons, fonts and colours it finds. It never clicks, types or logs in.
 * Screenshots are real pixels of the real page: use them as they are, or crop. Check them
 * for private data before you use them.
 */
import fs from "node:fs";
import path from "node:path";
import { findBrowser, loadPlaywright } from "./lib/tools.mjs";

const argv = process.argv.slice(2);
const url = argv.find((a) => /^https?:\/\//i.test(a)) || (argv[0] && !argv[0].startsWith("--") ? "https://" + argv[0] : null);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const out = opt("out");
if (!url || !out) { console.error("usage: node capture.mjs <url> --out <folder> [--width 1440] [--height 900] [--scale 2] [--max 8]"); process.exit(1); }
const width = Number(opt("width", 1440));
const height = Number(opt("height", 900));
const scale = Number(opt("scale", 2));
const max = Number(opt("max", 8));

const b = findBrowser();
if (!b) { console.error("No browser found. Run /media-studio:setup."); process.exit(1); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: b.path, headless: true });
fs.mkdirSync(out, { recursive: true });
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => { await document.fonts.ready; });
  const info = await page.evaluate(() => {
    const text = (el) => (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 160);
    const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const body = cs(document.body), h1 = cs(document.querySelector("h1")), a = cs(document.querySelector("a"));
    return {
      url: location.href,
      title: document.title,
      description: meta("description"),
      openGraph: { title: meta("og:title"), description: meta("og:description"), image: meta("og:image") },
      headings: [...document.querySelectorAll("h1,h2,h3")].slice(0, 40).map((h) => ({ tag: h.tagName.toLowerCase(), text: text(h) })).filter((h) => h.text),
      buttons: [...document.querySelectorAll("button,a[class*=btn],a[class*=button],[role=button]")].slice(0, 20).map(text).filter(Boolean),
      style: {
        bodyFont: body?.fontFamily, bodyColor: body?.color, bodyBackground: body?.backgroundColor,
        headingFont: h1?.fontFamily, headingColor: h1?.color, linkColor: a?.color,
      },
      pageHeight: document.documentElement.scrollHeight,
    };
  });
  fs.writeFileSync(path.join(out, "page-info.json"), JSON.stringify(info, null, 2) + "\n");
  const step = Math.round(height * 0.9);
  const shots = [];
  for (let i = 0, y = 0; i < max; i++, y += step) {
    if (i > 0 && y > info.pageHeight - height) break;
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(700);
    const f = path.join(out, `screen-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
  }
  console.log(`title: ${info.title}`);
  console.log(`saved ${shots.length} screenshot(s) and page-info.json in ${path.resolve(out)}`);
} finally {
  await browser.close();
}
