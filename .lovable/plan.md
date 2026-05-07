## Goal
Let sellers add a video (YouTube, Vimeo, etc.) to their program/product page so buyers can watch a live demo.

## What buyers see
A new "Demo Video" section on the program detail page (above the description), rendered as an embedded responsive 16:9 player. Only shown when the seller has set a video URL. Falls back gracefully if the URL can't be parsed.

## What sellers do
A new "Demo Video URL (Optional)" field in both:
- Sell Script form (`ProgramBasicForm`)
- Edit Program page (`EditProgram`)

Sellers paste a normal share URL (e.g. `https://youtu.be/abc`, `https://www.youtube.com/watch?v=abc`, `https://vimeo.com/123`). We auto-convert to the embed URL on render.

## Supported platforms (initial)
- YouTube (youtube.com/watch, youtu.be, youtube.com/shorts)
- Vimeo (vimeo.com/{id})
- Loom (loom.com/share/{id})

Anything else is rejected with a friendly inline validation message.

## Technical details

**Database (migration)**
- Add `demo_video_url TEXT NULL` column to `programs`.
- Update `validate_program_data()` trigger to sanitize/length-cap the URL (≤500 chars), no other validation server-side (parsing happens client-side).

**Frontend**
- New util `src/lib/videoEmbed.ts`:
  - `parseVideoEmbed(url): { provider: 'youtube'|'vimeo'|'loom', embedUrl: string } | null`
- New component `src/components/ProgramDetail/DemoVideo.tsx`: responsive 16:9 wrapper using Tailwind `aspect-video` + `<iframe allowfullscreen>`. Sandboxed with `allow="accelerated-encoding; autoplay; clipboard-write; encrypted-media; picture-in-picture"`.
- Render `<DemoVideo url={program.demo_video_url} />` in `src/pages/ProgramDetail.tsx` between `ProgramHeader` and the TradingView button.
- Add `demo_video_url` field to:
  - `formData` in `useSellScriptForm.ts` and `EditProgram.tsx`
  - `ProgramBasicForm.tsx` UI (URL input with helper text + live preview when valid)
  - Insert/update payloads in both flows
- Regenerate `src/integrations/supabase/types.ts` for the new column (auto-handled by migration).

## Out of scope (can revisit)
- Multiple videos per product (single URL for v1)
- Self-hosted video uploads
- Reordering video vs image gallery