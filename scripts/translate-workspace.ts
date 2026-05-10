// Bulk translate every user-facing string of a workspace into a target
// language and cache it in each row's `translations` JSONB. Uses the local
// Claude CLI (free OAuth) so we don't burn API tokens on big workspaces.
//
// Usage:
//   pnpm tsx scripts/translate-workspace.ts                 # dry-run, default workspace + fr
//   WORKSPACE_ID=<uuid> LANG=fr APPLY=1 pnpm tsx scripts/translate-workspace.ts
//
// What it translates:
//   - skills:           title, trigger, steps_md, decision_criteria, escalation
//   - glossary_entries: definition
//   - people:           summary, role_extracted

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.env.APPLY === "1";
const LANG = (process.env.LANG ?? "fr").toLowerCase();
const WS = process.env.WORKSPACE_ID ?? "f2985d6a-7985-466e-a3df-3a8ba2006211"; // BeStrong default
const BATCH = parseInt(process.env.BATCH ?? "10", 10);

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_KEY ?? "";
if (!url || !key) {
  console.error("[translate] missing SUPABASE_URL / SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const LANG_NAME: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
};
const targetName = LANG_NAME[LANG] ?? LANG;

console.log(`[translate] workspace=${WS} lang=${LANG} (${targetName}) apply=${APPLY ? "YES" : "DRY-RUN"}`);

function callClaudeCli(system: string, userMsg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model",
      "haiku",
      "--output-format",
      "text",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--append-system-prompt",
      system,
    ];
    const child = spawn("claude", args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude CLI timed out"));
    }, 90_000);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(-300)}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.stdin.write(userMsg);
    child.stdin.end();
  });
}

function parseJsonBlock<T>(text: string): T {
  const stripped = text
    .replace(/```(?:json)?\n?/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  return JSON.parse(stripped) as T;
}

// Tables that have an `updated_at` column. Sending it on tables without one
// (e.g. glossary_entries) makes the Supabase REST update fail with a schema-
// cache error. Conservative whitelist — extend when adding new tables.
const TABLES_WITH_UPDATED_AT = new Set(["skills", "people"]);

async function translateBatch(
  table: string,
  fieldsToTranslate: string[],
  rows: Array<{ id: string; translations: Record<string, Record<string, string>> | null } & Record<string, unknown>>,
) {
  if (rows.length === 0) return;
  // Build a numbered prompt so we can match outputs back to inputs.
  const inputs = rows.map((r, i) => {
    const obj: Record<string, string> = { id: String(i + 1) };
    for (const f of fieldsToTranslate) {
      const v = r[f];
      if (typeof v === "string" && v.trim().length > 0) obj[f] = v;
    }
    return obj;
  });

  const system =
    `You translate structured records into ${targetName}. ` +
    `Output ONLY a JSON array, one object per input, in the same order, with the same keys. ` +
    `Translate ONLY the value strings — keep keys, JSON shape, code identifiers, slugs, URLs, and proper nouns intact. ` +
    `Markdown formatting (headings, bullets, code fences) must be preserved exactly.`;
  const user =
    `Translate to ${targetName}. Input JSON array:\n\n` +
    JSON.stringify(inputs, null, 2);

  let translated: Array<Record<string, string>>;
  try {
    const text = await callClaudeCli(system, user);
    translated = parseJsonBlock(text);
  } catch (e) {
    console.error(`  ! batch failed: ${(e as Error).message}`);
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const t = translated[i];
    if (!t) continue;
    const newBlock: Record<string, string> = {};
    for (const f of fieldsToTranslate) {
      if (typeof t[f] === "string" && t[f].trim()) newBlock[f] = t[f];
    }
    if (Object.keys(newBlock).length === 0) continue;

    const nextTranslations = { ...(row.translations ?? {}), [LANG]: { ...(row.translations?.[LANG] ?? {}), ...newBlock } };
    console.log(`  ✓ ${table}#${row.id.slice(0, 8)} → translated ${Object.keys(newBlock).join(", ")}`);
    if (APPLY) {
      const update: Record<string, unknown> = { translations: nextTranslations };
      if (TABLES_WITH_UPDATED_AT.has(table)) update.updated_at = new Date().toISOString();
      const { error } = await db.from(table).update(update).eq("id", row.id);
      if (error) console.error(`    update failed: ${error.message}`);
    }
  }
}

async function translateTable(
  table: string,
  fieldsToTranslate: string[],
  selectFields: string,
) {
  console.log(`\n[${table}] selecting rows missing "${LANG}" translation…`);
  const { data, error } = await db
    .from(table)
    .select(`id, translations, ${selectFields}`)
    .eq("workspace_id", WS);
  if (error) {
    console.error(`  ! query failed: ${error.message}`);
    return;
  }
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    translations: Record<string, Record<string, string>> | null;
  } & Record<string, unknown>>;

  // Skip rows that already have a translation in the target lang for at least
  // one of the fields-to-translate (cheap idempotency).
  const todo = rows.filter((r) => {
    const block = r.translations?.[LANG];
    if (!block) return true;
    return fieldsToTranslate.some((f) => {
      const v = r[f];
      const hasSrc = typeof v === "string" && v.trim().length > 0;
      const hasDst = typeof block[f] === "string" && block[f].trim().length > 0;
      return hasSrc && !hasDst;
    });
  });
  console.log(`  ${rows.length} total · ${todo.length} need translation`);
  if (todo.length === 0) return;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    console.log(`  batch ${i / BATCH + 1}/${Math.ceil(todo.length / BATCH)} (${batch.length} rows)…`);
    await translateBatch(table, fieldsToTranslate, batch);
  }
}

async function main() {
  await translateTable(
    "skills",
    ["title", "trigger", "steps_md", "decision_criteria", "escalation"],
    "title, trigger, steps_md, decision_criteria, escalation",
  );
  await translateTable(
    "glossary_entries",
    ["definition"],
    "definition",
  );
  await translateTable(
    "people",
    ["summary", "role_extracted"],
    "summary, role_extracted",
  );

  console.log(`\n[translate] done${APPLY ? "" : " (DRY-RUN, re-run with APPLY=1 to persist)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
