# Auth setup — enabling Google sign-in

Slackmap uses Supabase Auth with Google as the only social provider.
Multiple teammates can sign in with Google and join the same workspace via
invite links. The Slack OAuth installer becomes the workspace **admin**.

This document is a one-time setup guide for the project owner.

## 1. Enable Google in Supabase

1. Open the Supabase Dashboard for the project.
2. Navigate to **Authentication → Providers → Google**.
3. Toggle **Enable Sign in with Google** on.
4. Provide the **Client ID** and **Client Secret** from a Google Cloud OAuth
   2.0 Client (type: **Web application**).
5. Save.

## 2. Add the Supabase callback URL to Google

In **Google Cloud Console → APIs & Services → Credentials**, edit the OAuth 2.0
Client. Under **Authorized redirect URIs**, add:

```
https://obgqofptepikczetcnsg.supabase.co/auth/v1/callback
```

(That hostname is the production Supabase project. If you are using a
different Supabase project, swap in its `<project-ref>.supabase.co` hostname.)

If you are also using Supabase locally (`supabase start`), the local equivalent
is `http://127.0.0.1:54321/auth/v1/callback`.

## 3. (Optional) Authorized JavaScript origins

For tightest CORS hygiene in Google's eyes, add the app origins to
**Authorized JavaScript origins** as well:

- `http://localhost:3030` (local dev)
- `https://slackmap.io` (production)

## 4. Verify it works

1. `pnpm run dev`
2. Visit `/login`.
3. Click **Continue with Google**. You should bounce to Google's consent
   screen, then back to `/api/auth/callback`, and end up at:
   - `/home?ws=<id>` if you already have a workspace membership, or
   - `/no-workspace` otherwise.

If Google sign-in fails, the browser console + Supabase Auth logs are the
fastest signal. The most common cause is a redirect URI mismatch — double-check
step 2.
