# Flow: stills (LinkedIn images, carousels, social cards, thumbnails, screenshots, device frames)

**Result:** PNG images or a multi-page PDF, made from one HTML file per format and rendered in a real browser, so type
is sharp and every pixel is checkable. Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md).

## Formats (sizes in pixels)
| Output | Size | File |
|---|---|---|
| LinkedIn single image | 1200x627 (landscape), 1080x1350 (4:5 portrait) or 1080x1080 | PNG (or JPEG if small is needed) |
| LinkedIn carousel (swipeable document post) | pages of 1080x1350, one PDF | PDF, at most 300 pages and 100 MB |
| Social / Open Graph card | 1200x630 | PNG |
| Video thumbnail or poster | 1280x720 (16:9) | PNG |
| Website screenshot | viewport 1440x900 at 2x scale | PNG (`capture.mjs`) |
| Device-framed screenshot | any; frame drawn in CSS | PNG |

LinkedIn's rules change without notice: the numbers above and their sources and dates are in `<SKILL>/flows/linkedin.md`.
The feed shows images at 4:5 at most, so a taller image is cropped.

## 1. Source: real pixels only
- App or website screenshots: `node "<SKILL>/scripts/capture.mjs" <url> --out "<run>/capture"` (real pages), or the user's own
  screenshots or recordings (see `demo.md` for capturing an app). Check them for private data first.
- Never make product UI with an image model, and never rebuild a screen from HTML to look like the app. Text, shapes, brand
  colours and real screenshots are fine; invented product screens are not.
- No invented numbers, logos, customers or quotes. Use only text and figures the user gave you or the product shows.

## 2. Design (taste rules, short version)
Full rules: `<SKILL>/vendor/scroll-craft/references/taste.md` (read it for anything beyond a plain card).
- The brand's own colours and fonts if it has them; otherwise two font families at most (system fonts are fine) and one accent.
- Measure contrast: body text at least 4.5:1 against its background (WCAG formula). Large headline type at least 3:1.
- One idea per image or per page. Big type (60 px and up on a 1080 wide page). Left-aligned by default. Generous margins.
- No gradient text, no neon glow, no em dashes, no stock-photo filler, no emoji bullets, no "01 / 06" counters.
- Device frame: a plain window or phone outline drawn in CSS around a REAL screenshot. Never use Apple or other vendors' device artwork.
- Carousels: page 1 is the hook (a claim or a question the next pages answer), the middle pages carry one point each, the last
  page is one clear action. Keep it short.

## 3. Build the HTML
- One file per format in `<run>/stills/` (`card.html`, `carousel.html`). Fixed pixel sizes, no scrolling, assets by relative
  path or `file://`, fonts from the system or a local file (a web font URL needs the network at render time).
- Carousel file: every page is `<section class="page">` sized exactly 1080x1350, with
  `@page { size: 1080px 1350px; margin: 0 }` and `.page { break-after: page; }`.

## 4. Render
- PNG: `node "<SKILL>/scripts/still.mjs" "<run>/stills/card.html" --png "<run>/out/card.png" --width 1200 --height 630`
- Carousel PDF: `node "<SKILL>/scripts/still.mjs" "<run>/stills/carousel.html" --pdf "<run>/out/carousel.pdf" --width 1080 --height 1350`
- One PNG per page (to read them, or to post as an image set): add `--pages "<run>/work/pages"` instead of `--pdf`.
- It waits for fonts and images, and prints a WARNING when content overflows its box (clipped text). Fix every warning.
- Sharper output: `--scale 2` doubles the pixels (the file size grows).

## 5. Check and deliver
1. READ every PNG (for a PDF, read the per-page PNGs). Check clipped or crowded text, contrast, alignment, orphan words.
2. Confirm sizes: `node "<SKILL>/scripts/media.mjs" probe "<file>"` (width, height, pages, bytes).
3. Privacy sweep: no keys, emails, home paths, customer data, employer or NDA content.
4. Write alt text (one or two plain sentences describing what is shown, including any text in the image) and add each file:
   `node "<SKILL>/scripts/media.mjs" add --run "<run>" --path "<run>/out/card.png" --kind image --alt "..."`
   (use `--kind carousel_pdf` for the PDF). It warns when a file breaks a LinkedIn limit.
5. Report paths, sizes and alt text. Offer to try another layout or palette.
