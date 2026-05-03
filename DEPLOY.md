# Deploy Slackmap to production

Step-by-step. Total time: ~25 min if you have Vercel/Supabase/Anthropic
accounts ready.

---

## 1) Provision Supabase Cloud (~5 min)

1. Go to https://supabase.com/dashboard → **New project**
2. Name: `slackmap`. Region: closest to you (EU central if you're in France).
   Set a strong DB password and **save it**.
3. Wait ~30s for the project to spin up.
4. **Settings → API**, copy and save:
   - `Project URL` (e.g. `https://abcd1234.supabase.co`)
   - `service_role` key (the **secret** one, NOT `anon`)
   - `anon public` key (this one is safe to expose)

5. **Run the migrations**. From your local clone:
   ```bash
   cd ~/Developer/Side/slackmap
   supabase link --project-ref <YOUR_PROJECT_REF>
   # project ref is the subdomain, e.g. "abcd1234"
   supabase db push
   ```
   This applies all 9 migrations + creates all tables.

6. **Seed the demo workspace** so landing-page visitors can preview:
   ```bash
   psql "postgresql://postgres:<YOUR_DB_PASSWORD>@db.<YOUR_REF>.supabase.co:5432/postgres" \
     -f supabase/seed.sql
   ```

---

## 2) Anthropic API key (~1 min)

1. https://console.anthropic.com/settings/keys → **Create Key**
2. Name: `slackmap-prod`. Copy the `sk-ant-...` value.
3. Add **at least $20** of credits (Settings → Plans & Billing). One workspace
   backfill ≈ $5-15.

---

## 3) Update the Slack App for production (~3 min)

You already created the Slack App for local. For production:

1. https://api.slack.com/apps → your **Slackmap** app → **OAuth & Permissions**
2. **Redirect URLs** → Add: `https://slackmap.vercel.app/api/slack/oauth/callback`
   (replace with your real Vercel URL once you have it)
3. **Event Subscriptions** → enable, Request URL =
   `https://slackmap.vercel.app/api/slack/events`. Slack will verify it
   automatically once Vercel is up.
4. Save.

---

## 4) Deploy to Vercel (~5 min)

### Option A — via the Vercel website (recommended)

1. https://vercel.com/new → **Import Git Repository**
2. Select `Jean-EmmanuelP/slackmap`
3. Framework: **Next.js** (auto-detected). Build command default. **Don't deploy yet.**
4. Click **Environment Variables**, add all of these:

| Name                           | Value                                               |
|--------------------------------|-----------------------------------------------------|
| `SLACK_CLIENT_ID`              | from Slack App → Basic Information                  |
| `SLACK_CLIENT_SECRET`          | from Slack App → Basic Information                  |
| `SLACK_SIGNING_SECRET`         | from Slack App → Basic Information                  |
| `SLACK_REDIRECT_URI`           | `https://slackmap.vercel.app/api/slack/oauth/callback` |
| `ANTHROPIC_API_KEY`            | `sk-ant-...` from step 2                            |
| `SUPABASE_URL`                 | `https://abcd1234.supabase.co` from step 1          |
| `SUPABASE_SERVICE_KEY`         | service_role key from step 1                        |
| `NEXT_PUBLIC_SUPABASE_URL`     | same as `SUPABASE_URL`                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| anon key from step 1                                |
| `ENCRYPTION_KEY`               | run `openssl rand -base64 32` and paste output      |
| `NEXT_PUBLIC_APP_URL`          | `https://slackmap.vercel.app`                       |
| `INNGEST_EVENT_KEY`            | (leave empty for now — see step 5)                  |
| `INNGEST_SIGNING_KEY`          | (leave empty for now — see step 5)                  |

5. Click **Deploy**. Wait ~2 min.
6. You'll get your URL. If it's not `slackmap.vercel.app`, update the Slack
   App's redirect URLs and the `SLACK_REDIRECT_URI` + `NEXT_PUBLIC_APP_URL`
   env vars to match (Vercel → Project → Settings → Environment Variables → edit).

### Option B — via Vercel CLI

```bash
npm i -g vercel
cd ~/Developer/Side/slackmap
vercel login
vercel --prod
# follow prompts, then add env vars via dashboard or:
vercel env add SLACK_CLIENT_ID production
# ... repeat for each
vercel --prod  # redeploy
```

---

## 5) Inngest production setup (~3 min)

Inngest handles all the async workers (backfill, mine-channel, extract-people,
extract-skills). Free tier covers 50K runs/month — enough for several
workspaces.

1. https://app.inngest.com → **Sign up** (use your GitHub)
2. **Apps** → **Sync new app** → enter `https://slackmap.vercel.app/api/inngest`
3. Inngest auto-discovers all your functions.
4. **Manage → Event Keys** → copy your **production event key**.
5. **Manage → Signing Key** → copy the signing key.
6. Back in Vercel → Project Settings → Environment Variables:
   - `INNGEST_EVENT_KEY` = the event key
   - `INNGEST_SIGNING_KEY` = the signing key
   - **Remove** `INNGEST_DEV` if it's there
7. Redeploy: `vercel --prod` or push a commit.

---

## 6) Test end-to-end

1. Open `https://slackmap.vercel.app`
2. Click **Connect your Slack** → authorize on Slack
3. You should land on `/atlas?ws=<your-workspace-id>` with the backfill running
4. Open Inngest Cloud dashboard → **Functions** to watch jobs run
5. After 5-10 min, refresh — channels should be listed, click "Mine all public"
6. After ~30 min, `/people` and `/skills` populate

---

## Troubleshooting

- **"invalid_client_id" on Connect Slack**: Slack App's redirect URLs don't
  include the Vercel URL. Add it.
- **OAuth callback fails with 500**: Supabase `service_role` key wrong, OR
  `ENCRYPTION_KEY` missing.
- **Backfill never runs**: Inngest production sync didn't pick up the app.
  Re-sync from Inngest dashboard.
- **Skills extraction returns 0**: Anthropic API key missing or out of credits.

---

## Cost estimate (single workspace, monthly)

| Service        | Free tier covers       | Paid if you exceed         |
|----------------|------------------------|----------------------------|
| Vercel         | Hobby (1 user)         | $20/mo Pro for team usage  |
| Supabase       | Free (500MB DB, 2GB BW)| $25/mo Pro for prod        |
| Inngest        | 50K runs/mo            | $20/mo for 250K runs       |
| Anthropic API  | -                      | ~$5-15 backfill, ~$2-5/mo  |
| **Total v1**   |                        | **~$10-20/mo per workspace**|

Once you have paying B2B customers, this is negligible vs revenue.

---

## YC application narrative anchor

You shipped this in 1 day:
- Multi-tenant SaaS connecting Slack OAuth to Anthropic-extracted skills
- Open source on GitHub
- Live demo accessible to anyone (no setup)
- Tom Blomfield Company Brain thesis, but executed end-to-end
- Network effect: more team members connect → richer brain
