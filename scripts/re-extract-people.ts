// Re-extract people profiles using existing people_activity rows + cached
// channel data — fast (~1 min) because no Slack fetch is needed. Only the
// LLM call per person is performed. Use after relaxing/tightening the
// `people` prompt to update profiles in place.
//
// Usage:
//   pnpm tsx scripts/re-extract-people.ts

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import { WebClient } from "@slack/web-api";
import { createDecipheriv, createHash } from "node:crypto";
import { fetchMessagesSince, sixMonthsAgoTs } from "../src/lib/slack";
import { extractPerson } from "../src/lib/extract/people";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = req("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = req("SUPABASE_SERVICE_KEY");
const ENCRYPTION_KEY = req("ENCRYPTION_KEY");
const WORKSPACE_ID = req("WORKSPACE_ID");

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function decryptLocal(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const key = createHash("sha256").update(ENCRYPTION_KEY).digest();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

async function rest(method: string, path: string, body?: unknown, query?: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path.replace(/^\//, "")}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "content-type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function selectMany<T>(table: string, query: Record<string, string>): Promise<T[]> {
  const r = await rest("GET", table, undefined, query);
  if (!r.ok) {
    console.error(`select ${table}: ${r.status}`);
    return [];
  }
  return (await r.json()) as T[];
}

async function update(table: string, query: Record<string, string>, body: unknown) {
  const r = await rest("PATCH", table, body, query);
  if (!r.ok) console.error(`update ${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function main() {
  process.env.LLM_BACKEND = "cli";
  delete process.env.ANTHROPIC_API_KEY;

  // Decrypt the Slack token for fetching message samples (people prompt needs them).
  const ws = await selectMany<{
    encrypted_user_token: string | null;
    encrypted_bot_token: string;
  }>("workspaces", {
    select: "encrypted_user_token,encrypted_bot_token",
    id: `eq.${WORKSPACE_ID}`,
  });
  if (ws.length === 0) throw new Error("workspace not found");
  const token = ws[0].encrypted_user_token
    ? decryptLocal(ws[0].encrypted_user_token)
    : decryptLocal(ws[0].encrypted_bot_token);
  const slack = new WebClient(token);

  const channels = await selectMany<{
    slack_channel_id: string;
    name: string;
    purpose_extracted: string | null;
  }>("channels", {
    select: "slack_channel_id,name,purpose_extracted",
    workspace_id: `eq.${WORKSPACE_ID}`,
    archived: "eq.false",
  });
  const chMap = new Map(channels.map((c) => [c.slack_channel_id, c]));

  // Get current people (with role) — only refresh existing profiles.
  const people = await selectMany<{
    id: string;
    slack_user_id: string;
    display_name: string | null;
    real_name: string | null;
    title: string | null;
    message_count: number;
  }>("people", {
    select: "id,slack_user_id,display_name,real_name,title,message_count",
    workspace_id: `eq.${WORKSPACE_ID}`,
    is_bot: "eq.false",
    is_deleted: "eq.false",
    role_extracted: "not.is.null",
    order: "message_count.desc",
    limit: "30",
  });
  console.log(`[setup] ${people.length} people to refresh`);

  const oldest = sixMonthsAgoTs();
  for (const p of people) {
    // Get this person's top channels from people_activity.
    const activity = await selectMany<{
      slack_channel_id: string;
      message_count: number;
    }>("people_activity", {
      select: "slack_channel_id,message_count",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slack_user_id: `eq.${p.slack_user_id}`,
      order: "message_count.desc",
      limit: "5",
    });
    if (activity.length === 0) continue;

    const topChannels = activity.map((a) => {
      const ch = chMap.get(a.slack_channel_id);
      return {
        name: ch?.name ?? a.slack_channel_id,
        purpose: ch?.purpose_extracted ?? null,
        count: a.message_count,
      };
    });

    // Sample messages from those channels (only this user's).
    const samples: string[] = [];
    for (const a of activity) {
      try {
        const msgs = await fetchMessagesSince(slack, a.slack_channel_id, oldest, 5);
        const theirs = msgs.filter((m) => m.user === p.slack_user_id && m.text).slice(0, 8);
        for (const m of theirs) samples.push(m.text!);
      } catch {
        // skip channel
      }
      if (samples.length >= 25) break;
    }

    try {
      const out = await extractPerson({
        display_name: p.display_name,
        real_name: p.real_name,
        title: p.title,
        topChannels,
        sampleMessages: samples,
        totalMessages: p.message_count,
      });
      await update(
        "people",
        { id: `eq.${p.id}` },
        {
          role_extracted: out.role,
          summary: out.summary,
          tools: out.tools,
          expertise: out.expertise,
          updated_at: new Date().toISOString(),
        },
      );
      const t = (out.tools || []).join(", ") || "—";
      console.log(`  ${p.display_name ?? p.slack_user_id}: ${out.role}  tools=[${t}]`);
    } catch (e) {
      console.warn(`  ! ${p.slack_user_id}: ${(e as Error).message}`);
    }
  }
  console.log("\n✅ done");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
