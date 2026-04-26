# Real Estate SMS CRM

Next.js + Supabase + Telnyx CRM for managing seller leads, CSV imports, SMS conversations, follow-ups, and DNC compliance.

## Stack

- Next.js App Router
- React
- Tailwind CSS
- Supabase Auth + Postgres
- Telnyx Messaging API
- Vercel deployment

## 1. Local Project Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env.local
```

3. Fill in the values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_USER_EMAIL=
TELNYX_API_KEY=
TELNYX_FROM_NUMBER=
TELNYX_MESSAGING_PROFILE_ID=
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## 2. Supabase Setup Step-by-Step

1. Create a Supabase account at [supabase.com](https://supabase.com).
2. Click `New project`.
3. Choose your organization.
4. Enter a project name.
5. Set a database password and save it somewhere secure.
6. Choose a region close to where you will run the app.
7. Create the project and wait for provisioning to finish.
8. In the Supabase dashboard, go to `Authentication` -> `Sign In / Providers`.
9. Make sure `Email` auth is enabled.
10. Optionally disable email confirmation while testing if you want faster local sign-ins.

## 3. Where To Paste `schema.sql`

1. In Supabase, open your project.
2. Go to `SQL Editor`.
3. Click `New query`.
4. Open [supabase/schema.sql](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/supabase/schema.sql).
5. Copy the entire file.
6. Paste it into the Supabase SQL editor.
7. Run the query.

This creates:

- `profiles`
- `leads`
- `messages`
- `notes`
- `followups`
- RLS policies
- profile auto-creation trigger
- lead `updated_at` trigger

## 4. How To Get Supabase URL, Anon Key, and Service Role Key

In Supabase:

1. Open `Project Settings`.
2. Click `API`.
3. Copy these values:

- `Project URL` -> use for `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
- `anon public` key -> use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` key -> use for `SUPABASE_SERVICE_ROLE_KEY`

Important:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe for the browser.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the client or public repo.

## 5. Create a Test User in Supabase Auth

Before seeding demo data, create a real login:

1. Run the app locally with `npm run dev`.
2. Open `/login`.
3. Sign in with an email/password that already exists in Supabase Auth.

If you do not have one yet:

1. In Supabase, go to `Authentication` -> `Users`.
2. Click `Add user`.
3. Create an email/password user manually.
4. Use that email to sign into the CRM.

The schema trigger will create the matching `profiles` row automatically.

## 6. Seed Demo Data

This repo includes a script that inserts demo leads, messages, notes, and follow-ups for one existing user.

File:

- [scripts/seed-demo-data.mjs](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/scripts/seed-demo-data.mjs)

Setup:

1. Make sure your `.env.local` includes:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEMO_USER_EMAIL=your-login-email@example.com
```

2. Make sure that email already exists in Supabase Auth.
3. Run:

```bash
npm run seed:demo
```

What it does:

- inserts 5 demo leads
- inserts outbound and inbound SMS history
- inserts notes
- inserts follow-ups due today and tomorrow
- removes older demo-tagged leads first so reruns stay clean

## 7. Telnyx Setup

### Buy a Number

1. Create a Telnyx account at [telnyx.com](https://telnyx.com).
2. Fund the account if required.
3. In the Telnyx portal, buy an SMS-capable phone number.
4. Save that number for `TELNYX_FROM_NUMBER`.

### Create a Messaging Profile

1. In Telnyx, go to the messaging section.
2. Create a new `Messaging Profile`.
3. Attach your purchased number to that profile.
4. Copy the Messaging Profile ID into `TELNYX_MESSAGING_PROFILE_ID`.

### API Key

1. In Telnyx, create an API key with messaging access.
2. Copy it into `TELNYX_API_KEY`.

### 10DLC Reminder

If you are texting US mobile numbers at scale, do not skip 10DLC registration.

- Register your brand and campaign in Telnyx before production outbound traffic.
- Unregistered long-code messaging can be filtered or blocked.
- Local testing may work before full registration, but production outreach should assume 10DLC is required.

### Where To Add the Webhook URL

In Telnyx:

1. Open your Messaging Profile.
2. Find the webhook or inbound messaging settings.
3. Add your inbound webhook URL:

```text
https://your-domain.com/api/telnyx/inbound
```

For local testing with ngrok:

```text
https://your-ngrok-subdomain.ngrok-free.app/api/telnyx/inbound
```

Use the app route already built in this repo:

- [app/api/telnyx/inbound/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/telnyx/inbound/route.ts)

## 8. Local Testing with ngrok

To receive live inbound Telnyx webhooks on your laptop:

1. Start the app:

```bash
npm run dev
```

2. In another terminal, start ngrok:

```bash
ngrok http 3000
```

3. Copy the HTTPS forwarding URL from ngrok.
4. In Telnyx, set the webhook URL to:

```text
https://YOUR-NGROK-URL/api/telnyx/inbound
```

5. Save the Telnyx profile settings.

Notes:

- The webhook must use the public HTTPS ngrok URL, not `localhost`.
- If ngrok changes URLs, update the webhook in Telnyx again.

## 9. How To Upload a CSV

1. Sign into the app.
2. Open `/leads`.
3. Use the `Upload CSV` panel.
4. Select a `.csv` file.
5. Click `Upload CSV`.

The upload route is:

- [app/api/upload-csv/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/upload-csv/route.ts)

CSV rows are upserted by `(user_id, phone_normalized)`, so importing the same lead again updates it instead of duplicating it.

## 10. Required CSV Headers

Required:

- `first_name`
- `last_name`
- `property_address`
- `phone`

Supported optional headers:

- `mailing_address`
- `email`
- `lead_source`
- `status`
- `tag`
- `notes`

Example:

```csv
first_name,last_name,property_address,mailing_address,phone,email,lead_source,status,tag,notes
John,Smith,"123 Main St, Dallas, TX","PO Box 22, Dallas, TX","214-555-0111",john@example.com,Driving for Dollars,New,warm,"Vacant and overgrown yard"
Sarah,Jones,"456 Oak Ave, Houston, TX","456 Oak Ave, Houston, TX","832-555-0112",sarah@example.com,Cold Calling,Contacted,follow-up,"Asked for callback next week"
```

## 11. How To Test Inbound SMS

After Telnyx and ngrok are connected:

1. Make sure the phone number sending the inbound SMS matches a lead in your database.
2. Send a text message to your Telnyx number from that phone.
3. The webhook will:

- store the inbound message
- match the lead by normalized phone number
- mark the lead as `Replied`
- show the conversation in `/inbox`

4. Open `/inbox` and verify the thread appears.

To test STOP compliance:

1. Send `STOP` as the inbound message.
2. The webhook will automatically:

- mark the lead as `DNC`
- prevent future sends to that lead
- add a note about the opt-out

## 12. DNC / STOP Compliance Behavior

This app currently enforces:

- outbound messages always append `Reply STOP to opt out.`
- bulk send skips `DNC` leads
- individual send blocks `DNC` leads
- inbound STOP-style replies mark the lead `DNC`

Relevant files:

- [app/api/telnyx/send/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/telnyx/send/route.ts)
- [app/api/send-bulk-sms/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/send-bulk-sms/route.ts)
- [app/api/telnyx/inbound/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/telnyx/inbound/route.ts)

## 13. Deploy to Vercel

1. Push this project to GitHub.
2. Create a new project in [Vercel](https://vercel.com).
3. Import the GitHub repository.
4. In Vercel project settings, add these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELNYX_API_KEY`
- `TELNYX_FROM_NUMBER`
- `TELNYX_MESSAGING_PROFILE_ID`

5. Deploy.
6. After deployment, update your Telnyx webhook URL to:

```text
https://your-vercel-domain.vercel.app/api/telnyx/inbound
```

7. Test:

- login
- CSV upload
- individual SMS
- bulk SMS
- inbound SMS webhook

## 14. Common Errors and Fixes

### `Unauthorized`

Cause:

- you are not signed in
- your Supabase session expired

Fix:

- sign in again
- confirm middleware is redirecting to `/login`

### `Lead not found`

Cause:

- wrong `leadId`
- lead belongs to another user

Fix:

- confirm the lead exists in `public.leads`
- confirm `user_id` matches the signed-in user

### `Cannot send to DNC lead`

Cause:

- the lead is marked `DNC`

Fix:

- this is expected behavior
- change the lead status only if that is legally appropriate

### Telnyx send fails

Cause:

- bad API key
- wrong messaging profile
- number not attached to profile
- 10DLC filtering or restrictions

Fix:

- verify `TELNYX_API_KEY`
- verify `TELNYX_FROM_NUMBER`
- verify `TELNYX_MESSAGING_PROFILE_ID`
- confirm the number is SMS-enabled
- check Telnyx logs

### Webhook not firing

Cause:

- wrong webhook URL
- local app not publicly reachable
- ngrok URL changed

Fix:

- confirm the webhook ends with `/api/telnyx/inbound`
- confirm ngrok is running
- update Telnyx with the latest ngrok or Vercel URL

### CSV upload says fields are missing

Cause:

- required headers are absent or misspelled

Fix:

- confirm these exact headers exist: `first_name`, `last_name`, `property_address`, `phone`

### `No Supabase Auth user found for ...` when seeding

Cause:

- `DEMO_USER_EMAIL` does not exist yet in Auth

Fix:

- create the user in Supabase Auth first
- sign into the app once
- rerun `npm run seed:demo`

### Build succeeds locally but SMS fails in production

Cause:

- Vercel env vars are missing

Fix:

- re-add all env vars in Vercel project settings
- redeploy

## 15. Useful Project Files

- [supabase/schema.sql](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/supabase/schema.sql)
- [app/api/telnyx/send/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/telnyx/send/route.ts)
- [app/api/send-bulk-sms/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/send-bulk-sms/route.ts)
- [app/api/telnyx/inbound/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/telnyx/inbound/route.ts)
- [app/api/upload-csv/route.ts](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/app/api/upload-csv/route.ts)
- [scripts/seed-demo-data.mjs](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/scripts/seed-demo-data.mjs)

## 16. Quick Start Checklist

1. Create Supabase project.
2. Run [supabase/schema.sql](/Users/acehigh/Documents/Codex/2026-04-24-build-a-full-stack-real-estate/supabase/schema.sql) in SQL Editor.
3. Fill in `.env.local`.
4. Create a Supabase Auth user.
5. Set `DEMO_USER_EMAIL`.
6. Run `npm run seed:demo`.
7. Run `npm run dev`.
8. Set up Telnyx.
9. Add webhook URL.
10. Test inbound SMS with ngrok.
