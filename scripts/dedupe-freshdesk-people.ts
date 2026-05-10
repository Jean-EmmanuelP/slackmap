// One-shot cleanup: merge Freshdesk-agent person rows back into existing
// Slack-derived people when the email matches. Fixes the legacy state where
// the same human appears twice (once as Slack user, once as freshdesk-agent-X).
//
// Strategy:
//   - Find every people row whose slack_user_id starts with "freshdesk-agent-"
//   - For each, look for another row in the same workspace with the same email
//     (case-insensitive) that is NOT a freshdesk-agent-X row
//   - If found:
//     * Add "Freshdesk" to the canonical row's tools[]
//     * Keep the canonical row's richer role (Slack-derived)
//     * Delete the freshdesk-agent row
//   - If not found, leave it (still a real Freshdesk-only agent — keep their row)
//
// Usage:
//   pnpm tsx scripts/dedupe-freshdesk-people.ts            # dry-run
//   APPLY=1 pnpm tsx scripts/dedupe-freshdesk-people.ts    # actually delete

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import { createClient } from "@supabase/supabase-js";

const APPLY = process.env.APPLY === "1";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_KEY ?? "";
if (!url || !key) {
  console.error("[dedupe] missing SUPABASE_URL / SUPABASE_SERVICE_KEY (.env.prod.local)");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

type Row = {
  id: string;
  workspace_id: string;
  slack_user_id: string;
  display_name: string | null;
  email: string | null;
  tools: string[] | null;
  role_extracted: string | null;
};

async function main() {
  console.log(`[dedupe] mode = ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const { data: agents, error: agentsErr } = await db
    .from("people")
    .select("id, workspace_id, slack_user_id, display_name, email, tools, role_extracted")
    .like("slack_user_id", "freshdesk-agent-%");
  if (agentsErr) throw agentsErr;
  console.log(`[dedupe] freshdesk-agent rows: ${agents?.length ?? 0}`);

  let merged = 0;
  let kept = 0;
  let skippedNoEmail = 0;

  function normName(s: string | null | undefined): string {
    return (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/\s+/g, " ")
      .trim();
  }

  for (const a of (agents ?? []) as Row[]) {
    const email = a.email?.trim().toLowerCase();
    let target: Row | undefined;
    let matchedBy: "email" | "name" | null = null;

    // Pass 1 — email match (highest confidence).
    if (email) {
      const { data: candidates, error: candErr } = await db
        .from("people")
        .select("id, workspace_id, slack_user_id, display_name, email, tools, role_extracted")
        .eq("workspace_id", a.workspace_id)
        .ilike("email", email)
        .neq("id", a.id)
        .not("slack_user_id", "like", "freshdesk-agent-%");
      if (candErr) throw candErr;
      target = candidates?.[0] as Row | undefined;
      if (target) matchedBy = "email";
    }

    // Pass 2 — exact normalised name match (still high confidence).
    if (!target && a.display_name) {
      const { data: byNameAll, error: nameErr } = await db
        .from("people")
        .select("id, workspace_id, slack_user_id, display_name, email, tools, role_extracted")
        .eq("workspace_id", a.workspace_id)
        .neq("id", a.id)
        .not("slack_user_id", "like", "freshdesk-agent-%");
      if (nameErr) throw nameErr;
      const norm = normName(a.display_name);
      const byNameFiltered = ((byNameAll ?? []) as Row[]).filter(
        (r) => normName(r.display_name) === norm,
      );
      target = byNameFiltered[0];
      if (target) matchedBy = "name";
    }

    if (!a.email && !a.display_name) {
      skippedNoEmail += 1;
      console.log(`  · ${a.slack_user_id} — no email and no name, skipping`);
      continue;
    }

    if (!target) {
      kept += 1;
      console.log(
        `  · ${a.display_name ?? "(no name)"} (${a.email ?? "no email"}) — no Slack match, keeping as Freshdesk-only`,
      );
      continue;
    }

    const currentTools = Array.isArray(target.tools) ? target.tools : [];
    const nextTools = currentTools.includes("Freshdesk")
      ? currentTools
      : [...currentTools, "Freshdesk"];
    const nextRole = target.role_extracted ?? "Support";

    console.log(
      `  ✓ ${a.display_name} (${a.email ?? "—"}) → merging into ${target.display_name} [${target.slack_user_id}] · matched by ${matchedBy}`,
    );
    console.log(`      tools: ${JSON.stringify(currentTools)} → ${JSON.stringify(nextTools)}`);

    if (APPLY) {
      const { error: updErr } = await db
        .from("people")
        .update({
          tools: nextTools,
          role_extracted: nextRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (updErr) throw updErr;

      const { error: delErr } = await db.from("people").delete().eq("id", a.id);
      if (delErr) throw delErr;
    }

    merged += 1;
  }

  console.log(`\n[dedupe] summary:`);
  console.log(`  merged: ${merged}`);
  console.log(`  kept (Freshdesk-only):   ${kept}`);
  console.log(`  skipped (no email):      ${skippedNoEmail}`);
  if (!APPLY) console.log(`\n  (DRY-RUN — re-run with APPLY=1 to actually update)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
