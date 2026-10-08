# Flow: LinkedIn handoff (media for a post)

**Result:** files ready for a LinkedIn post, a machine-readable `out/media.json` describing them, alt text, and the
exact limits they were checked against. media-studio never posts, publishes or schedules anything.
Replace `<SKILL>` and `<MS>` with the real paths (see SKILL.md).

## How it fits with a post-writing tool (for example the `linkedin-skills` plugin)
1. The user (or their post-writing skill) decides the post. If it needs a visual, run media-studio first: pick the flow
   (`stills.md` for an image or carousel, `teaser.md` / `demo.md` / `video.md` for a video).
2. media-studio writes the files and `<run>/out/media.json` (all local, free, from real material).
3. The post tool reads `media.json`. Two ways to attach the files:
   - **Manual (always works):** the user attaches the files in LinkedIn's composer (photo, video, or "Add a document" for a
     PDF) and pastes the alt text into LinkedIn's ALT field. Tell them the exact file paths.
   - **Via an API scheduler (for example Publora):** the scheduler needs the media at a PUBLIC https URL, or must upload
     it through its own upload call (below). Ask the user which they want; never upload anything without their yes.
4. Paid image generators (for example Pixfaro in the LinkedIn plugin) are a separate, optional route. media-studio is the
   free route built from the user's real footage.

## Output contract: `<run>/out/media.json`
A JSON list. Write entries with `node "<SKILL>/scripts/media.mjs" add --run "<run>" --path "<file>" --kind image|carousel_pdf|video --alt "..." [--captions file.srt] [--credit "..."]`.
Each entry:
```json
{
  "path": "out/teaser.mp4",            // relative to the run folder
  "absolutePath": "/full/path/out/teaser.mp4",
  "kind": "video",                      // image | carousel_pdf | video
  "width": 1080, "height": 1080,
  "durationSec": 6.016,                 // videos only
  "pages": 3,                           // carousel_pdf only
  "sizeBytes": 353124,
  "loudness": { "integratedLufs": -14.06, "truePeakDb": -1.49 },   // when there is audio
  "altText": "what a person who cannot see it needs to know",
  "captionsSrt": "out/teaser.srt",      // optional
  "credits": ["Music: Sascha Ende (ende.app), CC BY 4.0"],
  "linkedinSpec": { "format": "...", "maxSize": "...", "notes": "..." },
  "linkedinWarnings": []                // anything that breaks a known limit
}
```

## LinkedIn limits (read 2026-10-08; they change, re-check before a launch)
| Media | Limit | Source |
|---|---|---|
| Image | PNG, JPEG, GIF; under 36,152,320 pixels; the feed shows at most 4:5; up to 20 images per native post | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api (li-lms-2025-10), https://www.linkedin.com/help/lms/answer/a527229 |
| Document (carousel) | PDF (also PPT, PPTX, DOC, DOCX), at most 100 MB and 300 pages | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api (li-lms-2025-10) |
| Video | up to 5 GB; 3 s to 15 min; MP4 (also MOV, AVI, WEBM, MKV); 256x144 to 4096x2304; 10 to 60 fps; 192 Kbps to 30 Mbps; aspect 1:2.4 to 2.4:1 | https://www.linkedin.com/help/linkedin/answer/a548372 (page last updated about 2 years before the read date) |
| Mixing | one post carries images OR a video OR a document, not a mix | Publora platform limits |
| Recommended image sizes (1200x627, 1080x1350, 1080x1080) | design convention, not an official limit | community guides |

## If the scheduler is Publora (research, 2026-10-08, from https://docs.publora.com; nothing was called)
- Base URL `https://api.publora.com/api/v1`; every call sends the key in the header `x-publora-key`. The key lives in the
  user's environment: never read, print or paste it.
- **Local files CAN be uploaded** (so "attach by hand" is not the only route). Flow B: (1) `POST /create-post` without
  `scheduledTime` makes a draft and returns a `postGroupId`; (2) `POST /get-upload-url` with JSON
  `{"fileName","contentType","postGroupId","type"?}` returns `{success, uploadUrl, fileUrl, mediaId}` (the pre-signed S3
  `uploadUrl` expires in 1 hour); (3) `PUT` the file bytes to `uploadUrl` with the matching `Content-Type`; (4) optionally
  `POST /complete-media/:mediaId`; (5) `PUT /update-post/:postGroupId` to set `status:"scheduled"` and `scheduledTime`.
  `contentType` must be `image/*`, `video/*` or `application/pdf`.
- **One-shot alternative:** `POST /create-post` accepts `mediaUrls`: up to 10 PUBLIC https URLs that Publora downloads for you
  (rate limit 60 URLs per hour). This is what the LinkedIn plugin's `lib.publish(..., media_urls=[...])` sends as `mediaUrls`.
  So `media_urls` needs hosted URLs; a local path does not work there.
- The LinkedIn plugin's own client (`lib/publora_client.py`) has no upload method today: only `mediaUrls` on `create_post`. To use
  Flow B someone must add one (not done here; that plugin is read-only to us).
- Limits Publora enforces for LinkedIn: images up to 10 per post (36,152,320 pixel gate, 50 MB ceiling), video MP4 up to
  500 MB and 30 min through the API, no mixing of images, videos and documents. It states that organic swipeable carousels are
  NOT supported through the API. Its upload endpoint accepts PDFs and its error list mentions LinkedIn documents, but whether
  a PDF document post publishes through Publora is UNVERIFIED: treat the carousel PDF as a manual upload unless the user has tested it.
- Publora's live `GET /platform-limits` returns the current numbers (needs the user's key: let the user run it, do not).

## How to tell the user (plain words)
"The files are in <folder>. For the post, attach <files> yourself in LinkedIn (and paste this alt text), or tell me if you want
them uploaded through your scheduler: that needs your say-so and a hosted file or an upload step."
