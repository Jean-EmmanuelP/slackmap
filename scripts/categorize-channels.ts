// Categorize all active channels in a workspace via the local Claude CLI.
// Idempotent — safe to re-run. Use when channels show "—" in Atlas.
//
// Usage:
//   pnpm tsx scripts/categorize-channels.ts

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import { llmCategorize } from "../src/lib/extract/categorize";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = req("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = req("SUPABASE_SERVICE_KEY");
const WORKSPACE_ID = req("WORKSPACE_ID");

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

async function main() {
  process.env.LLM_BACKEND = "cli";
  delete process.env.ANTHROPIC_API_KEY;

  const res = await rest("GET", "channels", undefined, {
    select: "slack_channel_id,name,purpose_extracted,category",
    workspace_id: `eq.${WORKSPACE_ID}`,
    archived: "eq.false",
    limit: "100",
  });
  const all = (await res.json()) as Array<{
    slack_channel_id: string;
    name: string;
    purpose_extracted: string | null;
    category: string | null;
  }>;
  console.log(`[setup] ${all.length} active channels (${all.filter((c) => !c.category).length} uncategorized)`);

  const cats = await llmCategorize(all);
  console.log(`[llm] ${cats.length} channels classified`);

  for (const c of cats) {
    const r = await rest(
      "PATCH",
      "channels",
      { category: c.category, updated_at: new Date().toISOString() },
      {
        workspace_id: `eq.${WORKSPACE_ID}`,
        slack_channel_id: `eq.${c.slack_channel_id}`,
      },
    );
    if (!r.ok) console.error(`  ! ${c.slack_channel_id}: ${r.status}`);
    else console.log(`  ${c.slack_channel_id} → ${c.category}`);
  }
  console.log("\n✅ done");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
