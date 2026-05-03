// Local Freshdesk extraction → sync to PROD Supabase via REST.
// Uses direct fetch (supabase-js v2.105 was rejecting the service_role JWT
// with "Invalid API key" — direct REST works fine).
//
// LLM extraction uses the local `claude` CLI via OAuth (no API key needed).
//
// Usage:
//   pnpm tsx scripts/extract-freshdesk-local.ts

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import {
  FreshdeskClient,
  type FreshdeskSolutionArticle,
  type FreshdeskTicket,
  type FreshdeskConversation,
} from "../src/lib/freshdesk";
import {
  extractSkillsFromArticles,
  extractSkillsFromTickets,
  extractGlossaryFromFreshdesk,
} from "../src/lib/extract/freshdesk";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = req("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = req("SUPABASE_SERVICE_KEY");
const FRESHDESK_DOMAIN = req("FRESHDESK_DOMAIN");
const FRESHDESK_API_KEY = req("FRESHDESK_API_KEY");
const WORKSPACE_ID = req("WORKSPACE_ID");

async function rest(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path.replace(/^\//, "")}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "content-type": "application/json",
  };
  if (method !== "GET") headers["Prefer"] = "return=representation";
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function selectOne<T>(table: string, query: Record<string, string>): Promise<T | null> {
  const res = await rest("GET", table, undefined, query);
  if (!res.ok) {
    console.error(`  ! select ${table}: ${res.status} ${await res.text()}`);
    return null;
  }
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

async function update(table: string, query: Record<string, string>, body: unknown): Promise<void> {
  const res = await rest("PATCH", table, body, query);
  if (!res.ok) console.error(`  ! update ${table}: ${res.status} ${await res.text()}`);
}

async function insert(table: string, body: unknown): Promise<boolean> {
  const res = await rest("POST", table, body);
  if (!res.ok) {
    console.error(`  ! insert ${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

type ExtractedSkill = Awaited<ReturnType<typeof extractSkillsFromArticles>>[number];

async function upsertSkill(s: ExtractedSkill & { source: "freshdesk" }) {
  const now = new Date().toISOString();
  const existing = await selectOne<{ id: string; source_count: number; citations: ExtractedSkill["citations"] }>(
    "skills",
    {
      select: "id,source_count,citations",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slug: `eq.${s.slug}`,
    },
  );
  if (existing) {
    const seenTs = new Set((existing.citations ?? []).map((c) => c.ts));
    const merged = [...(existing.citations ?? [])];
    for (const c of s.citations) {
      if (!seenTs.has(c.ts)) {
        merged.push(c);
        seenTs.add(c.ts);
      }
    }
    const newCount = (existing.source_count ?? 0) + 1;
    const confidence = Math.min(0.99, 0.4 + 0.1 * Math.log2(newCount + 1));
    await update(
      "skills",
      { id: `eq.${existing.id}` },
      {
        title: s.title,
        domain: s.domain,
        trigger: s.trigger,
        steps_md: s.steps_md,
        decision_criteria: s.decision_criteria,
        escalation: s.escalation,
        citations: merged,
        source: "freshdesk",
        source_count: newCount,
        confidence,
        last_observed_at: now,
        updated_at: now,
      },
    );
    console.log(`  ~ skill: ${s.slug}`);
  } else {
    const ok = await insert("skills", {
      workspace_id: WORKSPACE_ID,
      type: s.type,
      domain: s.domain,
      slug: s.slug,
      title: s.title,
      trigger: s.trigger,
      steps_md: s.steps_md,
      decision_criteria: s.decision_criteria,
      escalation: s.escalation,
      citations: s.citations,
      source: "freshdesk",
      source_count: 1,
      confidence: 0.5,
      first_observed_at: now,
      last_observed_at: now,
      status: "draft",
    });
    if (ok) console.log(`  + skill: ${s.slug}`);
  }
}

async function upsertGlossary(entries: Array<{ term: string; definition: string; category: string }>) {
  for (const e of entries) {
    const existing = await selectOne<{ id: string; occurrences: number }>("glossary_entries", {
      select: "id,occurrences",
      workspace_id: `eq.${WORKSPACE_ID}`,
      term: `eq.${e.term}`,
    });
    if (existing) {
      await update(
        "glossary_entries",
        { id: `eq.${existing.id}` },
        {
          definition: e.definition,
          category: e.category,
          occurrences: existing.occurrences + 1,
          last_seen_at: new Date().toISOString(),
        },
      );
      console.log(`  ~ term: ${e.term}`);
    } else {
      const ok = await insert("glossary_entries", {
        workspace_id: WORKSPACE_ID,
        term: e.term,
        definition: e.definition,
        category: e.category,
        occurrences: 1,
        source: "freshdesk",
      });
      if (ok) console.log(`  + term: ${e.term}`);
    }
  }
}

async function main() {
  // Force CLI fallback even if a stale env var is around.
  process.env.LLM_BACKEND = "cli";
  delete process.env.ANTHROPIC_API_KEY;

  const fd = new FreshdeskClient(FRESHDESK_DOMAIN, FRESHDESK_API_KEY);
  console.log(`[freshdesk] pinging ${fd.host}…`);
  const me = await fd.ping();
  console.log(`[freshdesk] ok, agent=${me.agentEmail ?? "?"}`);

  await update(
    "workspaces",
    { id: `eq.${WORKSPACE_ID}` },
    { freshdesk_status: "running", freshdesk_error: null },
  );

  // 1) Solution articles
  console.log("\n[articles] fetching catalogue…");
  const cats = await fd.listSolutionCategories();
  console.log(`[articles] ${cats.length} categories`);
  const perFolderArticles: Array<{ folderName: string; article: FreshdeskSolutionArticle }> = [];
  for (const cat of cats.slice(0, 5)) {
    const folders = await fd.listFoldersForCategory(cat.id);
    for (const folder of folders.slice(0, 8)) {
      const articles = await fd.listArticlesInFolder(folder.id);
      for (const article of articles.slice(0, 12)) {
        perFolderArticles.push({ folderName: folder.name, article });
      }
    }
  }
  console.log(`[articles] ${perFolderArticles.length} articles to process`);

  let articleCount = 0;
  if (perFolderArticles.length > 0) {
    const skills = await extractSkillsFromArticles(fd, undefined, perFolderArticles);
    console.log(`[articles] ${skills.length} skills extracted, persisting…`);
    for (const s of skills) {
      await upsertSkill({ ...s, source: "freshdesk" });
      articleCount++;
    }
  }

  // 2) Recent tickets + conversations → recurring skills
  console.log("\n[tickets] fetching recent tickets…");
  const tickets = await fd.listRecentTickets({ perPage: 100, pages: 2 });
  console.log(`[tickets] ${tickets.length} tickets`);
  const withConvos: Array<{ ticket: FreshdeskTicket; conversations: FreshdeskConversation[] }> = [];
  for (const t of tickets.slice(0, 30)) {
    const convos = await fd.getTicketConversations(t.id).catch(() => []);
    withConvos.push({ ticket: t, conversations: convos });
  }
  let ticketCount = 0;
  if (withConvos.length > 0) {
    const skills = await extractSkillsFromTickets(fd, undefined, withConvos);
    console.log(`[tickets] ${skills.length} recurring skills extracted, persisting…`);
    for (const s of skills) {
      await upsertSkill({ ...s, source: "freshdesk" });
      ticketCount++;
    }
  }

  // 3) Glossary
  console.log("\n[glossary] building term corpus…");
  const texts: string[] = [];
  for (const { article } of perFolderArticles) {
    if (article.description_text) texts.push(`${article.title}\n${article.description_text}`);
  }
  for (const t of tickets) {
    texts.push(`${t.subject}\n${(t.description_text ?? "").slice(0, 800)}`);
  }
  const entries = await extractGlossaryFromFreshdesk(undefined, texts);
  console.log(`[glossary] ${entries.length} terms extracted, persisting…`);
  if (entries.length > 0) {
    await upsertGlossary(entries);
  }

  await update(
    "workspaces",
    { id: `eq.${WORKSPACE_ID}` },
    { freshdesk_status: "done" },
  );

  console.log(
    `\n✅ Done. articles=${articleCount}, tickets=${ticketCount}, glossary=${entries.length}`,
  );
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  await update(
    "workspaces",
    { id: `eq.${WORKSPACE_ID}` },
    { freshdesk_status: "failed", freshdesk_error: String((e as Error).message ?? e).slice(0, 500) },
  );
  process.exit(1);
});
