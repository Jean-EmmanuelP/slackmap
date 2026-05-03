# Slackmap

Connect a Slack workspace, get a live map of how the company actually works:
a channel atlas (auto-extracted purposes, categories, traffic) and a glossary
of internal jargon. Updates in real-time via Slack Events API.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- React Flow (`@xyflow/react`) for the channel graph
- Supabase Postgres (multi-tenant via `workspace_id`)
- Inngest (backfill, live updates, daily reconcile)
- Anthropic Claude API (Sonnet 4.6 for extraction, Haiku 4.5 for classification)
- Slack Web API + Events API

## Setup

### 1. Clone, install

```bash
pnpm install
cp .env.example .env.local
```

### 2. Provision Supabase

- Create a project at supabase.com
- In SQL Editor, run `supabase/migrations/0001_init.sql`
- Copy the Project URL and `service_role` key into `.env.local`

### 3. Create a Slack App

Go to https://api.slack.com/apps → Create New App → From scratch.

**OAuth & Permissions** → Bot Token Scopes:
- `channels:read`
- `channels:history`
- `users:read`
- `team:read`

**OAuth & Permissions** → Redirect URLs:
- `http://localhost:3000/api/slack/oauth/callback` (dev)
- `https://your-domain.vercel.app/api/slack/oauth/callback` (prod)

**Event Subscriptions** → Enable Events:
- Request URL: `https://your-domain.vercel.app/api/slack/events`
   (or your ngrok URL in dev — Slack must be able to reach this)
- Subscribe to bot events:
  - `message.channels`
  - `channel_created`
  - `channel_rename`
  - `channel_archive`
  - `channel_unarchive`

Copy `Client ID`, `Client Secret`, `Signing Secret` into `.env.local`.

### 4. Anthropic API key

Generate one at https://console.anthropic.com → put in `.env.local`.

### 5. Encryption key

```bash
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
```

### 6. Run

```bash
# Terminal 1 — Next.js
pnpm dev

# Terminal 2 — Inngest dev server (handles backfill + events)
pnpm dlx inngest-cli@latest dev

# Terminal 3 — ngrok (so Slack can reach your /api/slack/events webhook)
ngrok http 3000
# → copy the https URL into Slack App's Event Subscription Request URL
# → also update SLACK_REDIRECT_URI to use the ngrok URL
```

Open http://localhost:3000 → click Connect Slack → install the app on your
workspace. You'll be redirected to `/atlas?ws=<id>` and the backfill kicks off
immediately. Open the Inngest dev UI (http://localhost:8288) to watch progress.

When the backfill finishes (`backfill_status = 'ready'`), refresh `/atlas` to
see the channel graph and `/glossary` for the extracted terms.

## How it works

```
Slack OAuth ──▶ /api/slack/oauth/callback ──▶ store workspace ──▶ Inngest "backfill"
                                                                    │
                                                                    ▼
                                            list channels ──▶ for each: fetch 6mo msgs ──▶ Claude:
                                              ─ extract channel purpose
                                              ─ extract acronyms / jargon (regex + LLM define)
                                            categorize all channels in batch (Haiku)

Slack Events API ──▶ /api/slack/events ──▶ verify signature, dedupe ──▶ Inngest "on-slack-event"
                                                                    │
                                                                    ▼
                                            on message: extract candidate acronyms
                                              ─ if known: bump occurrences
                                              ─ if new: Claude defines, upsert glossary
                                            on channel_created/rename/archive: upsert metadata

Cron 04:00 UTC ──▶ Inngest "reconcile-daily" ──▶ refetch channel list + 24h delta
                                                  (catches anything missed by webhook)
```

## What's stored

- `workspaces` — Slack team metadata, encrypted bot token, backfill progress
- `channels` — id, name, purpose (native + LLM-extracted), category, metrics
- `glossary_entries` — term, definition, category, first-seen ref, occurrences
- `processed_events` — dedup table for Slack events

**Never stored**: message bodies. Only references `(channel_id, ts)` so that the
UI can deeplink back into Slack.

## Costs (rough)

- Backfill on a 100-person company, 50 active channels, 6 months: ~$5–10 in
  Claude API.
- Live updates: ~$1–3 / month.
- Vercel + Supabase + Inngest free tier covers a single workspace easily.

## Limitations (v0)

- Public channels only (`channels:history`). Add `groups:history` for private,
  but the bot must be invited into each.
- No people-map / processes / decisions views yet — see `plans/` for v1.
- No billing — the multi-tenant DB schema is in place, you'd add Stripe + auth
  on top.

## Project structure

```
src/
├── app/
│   ├── page.tsx                                 # Connect Slack landing
│   ├── atlas/page.tsx                           # Channel graph
│   ├── glossary/page.tsx                        # Glossary table
│   └── api/
│       ├── slack/oauth/callback/route.ts        # OAuth handler
│       ├── slack/events/route.ts                # Live events webhook
│       ├── inngest/route.ts                     # Inngest endpoint
│       └── workspace/[id]/route.ts              # JSON endpoint for workspace data
├── components/
│   ├── ChannelGraph.tsx                         # React Flow graph + side panel
│   ├── GlossaryTable.tsx                        # searchable table
│   ├── LiveStatus.tsx                           # status indicator
│   └── Nav.tsx
├── inngest/
│   ├── client.ts
│   ├── backfill.ts                              # initial mining
│   ├── on-slack-event.ts                        # live update worker
│   └── reconcile-daily.ts                       # nightly catch-up cron
└── lib/
    ├── db.ts                                    # Supabase client + typed queries
    ├── slack.ts                                 # WebClient, OAuth, signature verify
    ├── crypto.ts                                # AES-256-GCM token encryption
    ├── env.ts                                   # env var validation
    └── extract/
        ├── anthropic.ts                         # Claude client + helpers
        ├── channel-purpose.ts
        ├── glossary.ts                          # regex + LLM define
        └── categorize.ts                        # batch channel classification

supabase/migrations/0001_init.sql                # schema + RLS
```
