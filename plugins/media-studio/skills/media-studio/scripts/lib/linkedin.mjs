// LinkedIn media limits, with sources and the date they were read.
// Re-check before relying on them: LinkedIn changes these without notice.
export const LINKEDIN_SOURCES = {
  asOf: "2026-10-08",
  video: "https://www.linkedin.com/help/linkedin/answer/a548372 (Video sharing troubleshooting)",
  photos: "https://www.linkedin.com/help/lms/answer/a527229 (Share photos on LinkedIn)",
  imagesApi: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api (li-lms-2025-10)",
  documentsApi: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api (li-lms-2025-10)",
  publora: "https://docs.publora.com/guides/platform-limits (limits synced 2026-03-11)",
};

export function linkedinSpec(kind) {
  if (kind === "image") {
    return {
      format: "PNG, JPEG or GIF. Good sizes: 1200x627 (landscape link-style), 1080x1350 (4:5 portrait), 1080x1080 (square). Up to 20 images in one native post; the feed shows a maximum 4:5 ratio.",
      maxSize: "Under 36,152,320 pixels (Images API). Via Publora: up to 10 images per post, 50 MB ceiling.",
      notes: "Add alt text. Do not mix images with a video or a document in one post.",
    };
  }
  if (kind === "carousel_pdf") {
    return {
      format: "PDF document post (this is how a swipeable carousel is made by hand). 1080x1350 pages recommended.",
      maxSize: "100 MB and 300 pages (Documents API). PPT, PPTX, DOC, DOCX and PDF are accepted.",
      notes: "Publora says organic swipeable carousels are not supported through its API; its upload endpoint does accept application/pdf, but whether the LinkedIn publisher posts it is unverified. Post the PDF by hand if unsure. Do not mix a document with images or a video.",
    };
  }
  return {
    format: "MP4 recommended (MOV, AVI, WEBM, MKV also accepted by the app). Aspect ratio between 1:2.4 and 2.4:1. 256x144 to 4096x2304, 10 to 60 fps, 192 Kbps to 30 Mbps.",
    maxSize: "Up to 5 GB and 3 seconds to 15 minutes natively. Via Publora's API: up to 500 MB and 30 minutes, MP4.",
    notes: "Most people watch muted: ship captions. Keep key text away from the edges (LinkedIn overlays its own buttons).",
  };
}

/** Compare measured values with the limits above. Returns human-readable warnings. */
export function lintForLinkedin(entry) {
  const w = [];
  if (entry.kind === "video") {
    if (entry.durationSec != null && entry.durationSec < 3) w.push("video is shorter than LinkedIn's 3 second minimum");
    if (entry.durationSec != null && entry.durationSec > 15 * 60) w.push("video is longer than 15 minutes (native limit)");
    if (entry.sizeBytes > 5 * 1024 ** 3) w.push("video is larger than 5 GB");
    else if (entry.sizeBytes > 500 * 1024 ** 2) w.push("video is larger than 500 MB: too big for Publora's API, fine for manual upload");
    if (entry.width && entry.height) {
      const r = entry.width / entry.height;
      if (r < 1 / 2.4 || r > 2.4) w.push("aspect ratio is outside 1:2.4 to 2.4:1");
    }
  } else if (entry.kind === "image") {
    if (entry.width && entry.height && entry.width * entry.height >= 36152320) w.push("image has 36,152,320 pixels or more");
  } else if (entry.kind === "carousel_pdf") {
    if (entry.pages > 300) w.push("PDF has more than 300 pages");
    if (entry.sizeBytes > 100 * 1024 ** 2) w.push("PDF is larger than 100 MB");
  }
  return w;
}
