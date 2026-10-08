#!/usr/bin/env node
/**
 * Turn an HTML file into a PNG, a one-PNG-per-page set, or a multi-page PDF.
 * Uses playwright-core from the workspace plus an installed Chrome/Edge (or Remotion's
 * headless shell). Same on macOS, Windows and Linux.
 *
 *   node still.mjs card.html --png out/card.png --width 1200 --height 630 [--scale 1]
 *   node still.mjs slides.html --pdf out/carousel.pdf --width 1080 --height 1350
 *   node still.mjs slides.html --pages out/pages --width 1080 --height 1350 [--scale 1]
 *
 * For --pdf and --pages, put each page in an element with class "page" sized exactly
 * width x height, and add  @page { size: 1080px 1350px; margin: 0 }  plus
 * .page { break-after: page; }  in the HTML.
 *
 * Before it saves anything it waits for fonts and images, and warns when the content
 * overflows the page (a common cause of clipped text).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findBrowser, fmtBytes, loadPlaywright } from "./lib/tools.mjs";

const argv = process.argv.slice(2);
const html = argv.find((a) => !a.startsWith("--") && /\.html?$/i.test(a));
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const width = Number(opt("width", 1200));
const height = Number(opt("height", 630));
const scale = Number(opt("scale", 1));
const png = opt("png");
const pdf = opt("pdf");
const pagesDir = opt("pages");
if (!html || (!png && !pdf && !pagesDir)) {
  console.error("usage: node still.mjs <file.html> (--png out.png | --pdf out.pdf | --pages dir) --width W --height H [--scale N]");
  process.exit(1);
}

const pngSize = (p) => {
  const b = fs.readFileSync(p);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const browserInfo = findBrowser();
if (!browserInfo) { console.error("No browser found. Run /media-studio:setup."); process.exit(1); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: browserInfo.path, headless: true });
const out = [];
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  const over = await page.evaluate(({ w, h }) => {
    const pages = [...document.querySelectorAll(".page")];
    const bad = [];
    const targets = pages.length ? pages : [document.documentElement];
    targets.forEach((el, i) => {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) bad.push(`${pages.length ? ".page #" + (i + 1) : "page"} overflows (${el.scrollWidth}x${el.scrollHeight} inside ${el.clientWidth}x${el.clientHeight})`);
    });
    if (!pages.length && (document.documentElement.scrollWidth > w + 1)) bad.push("content is wider than the viewport");
    return bad;
  }, { w: width, h: height });
  for (const w of over) console.error("WARNING: " + w);

  if (png) {
    fs.mkdirSync(path.dirname(path.resolve(png)), { recursive: true });
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width, height } });
    const s = pngSize(png);
    out.push({ file: path.resolve(png), kind: "image", ...s, bytes: fs.statSync(png).size });
  }
  if (pagesDir) {
    fs.mkdirSync(pagesDir, { recursive: true });
    const els = await page.$$(".page");
    if (!els.length) throw new Error('--pages needs elements with class "page"');
    for (let i = 0; i < els.length; i++) {
      const f = path.join(pagesDir, `page-${i + 1}.png`);
      await els[i].screenshot({ path: f });
      out.push({ file: path.resolve(f), kind: "image", ...pngSize(f), bytes: fs.statSync(f).size });
    }
  }
  if (pdf) {
    fs.mkdirSync(path.dirname(path.resolve(pdf)), { recursive: true });
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: pdf, width: `${width}px`, height: `${height}px`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const txt = fs.readFileSync(pdf).toString("latin1");
    const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    out.push({ file: path.resolve(pdf), kind: "carousel_pdf", pages, bytes: fs.statSync(pdf).size });
  }
} finally {
  await browser.close();
}
for (const o of out) console.log(`${o.file}  ${o.kind}  ${o.width ? o.width + "x" + o.height : o.pages + " page(s)"}  ${fmtBytes(o.bytes)}`);
if (argv.includes("--json")) console.log(JSON.stringify(out));
