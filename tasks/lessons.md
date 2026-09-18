# Lessons

Rules learned from real failures in this repo. Read before touching Supabase, Telnyx, or the inbox.

## Supabase
- **Check that `SUPABASE_SERVICE_ROLE_KEY` belongs to the project in `SUPABASE_URL`.** A legacy key is a JWT; its `ref` claim must equal the project subdomain. A mismatched key yields a bare `Invalid API key` (401) on every server call. `lib/supabase/admin.ts` now logs this at startup.
- **The Supabase project (`wdbxxjfgitlxeoluvanf`) is shared with the ForeclosureScraper.** Never drop/rename anything, never change RLS on `foreclosure_leads`. Migrations here are additive only.
- **"Could not find the 'X' column ... in the schema cache" means the live DB is behind the code**, not that the code is wrong. Probe the live schema first (PostgREST `select=col&limit=0` works with the anon key) before editing code. End migrations with `notify pgrst, 'reload schema'`.
- **`@supabase/ssr@0.5` + `supabase-js@2.10x` types every session-client query as `never`.** `lib/supabase/{server,browser}.ts` re-type the client to `SupabaseClient<Database>`. Do not paper over it with `as never` / `as unknown as` at call sites.
- Interactive routes and server actions use the signed-in user's client (RLS enforces `user_id`). Reserve the service-role client for the Telnyx webhook.
- Never re-import a CSV with `upsert` — it overwrites `is_dnc`/status on existing leads. Insert new rows only.
- Never hardcode the Supabase URL/key in components; use `NEXT_PUBLIC_*` env vars. Always check `res.ok` on raw REST fetches.

## Telnyx
- The inbound webhook must return 200 on every path (Telnyx retries otherwise); the only exception is a failed signature check. Order: verify -> match lead -> **save message** -> respond -> classify in `after()`.
- Read a failed Telnyx response body once (`.text()` then `JSON.parse`). Calling `.json()` then `.text()` throws "body already used".
- Use `telnyx_message_id: null`, never `""`, for unknown ids (unique column).

## Classification
- Never use substring matching for short SMS keywords (`"end"` is in "send"/"weekend", `"yes"` in "yesterday"). Use whole-word matching; opt-out keywords count only when they are the entire message.

## UI
- Realtime: subscribe with a `user_id` filter, use a per-user channel name, always `removeChannel` on cleanup, and log `CHANNEL_ERROR`/`TIMED_OUT` (with a polling fallback for the inbox).
- Optimistic messages: the stored body has the STOP footer appended, so match temp bubbles by prefix, not equality.
- Show `userFacingError()` text to users; log the raw error server-side. Never show a raw schema-cache message.
