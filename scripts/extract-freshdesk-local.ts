// Local Freshdesk extraction → sync to PROD Supabase via REST.
// Uses direct fetch (supabase-js v2.105 was rejecting the service_role JWT
// with "Invalid API key" — direct REST works fine).
//
// LLM extraction uses the local `claude` CLI via OAuth (no API key needed).
//
// Usage:
//   pnpm tsx scripts/extract-freshdesk-local.ts
//
// Quick test (cap tickets to 10 for fast iteration):
//   FRESHDESK_TICKET_CAP=10 pnpm tsx scripts/extract-freshdesk-local.ts

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import {
  FreshdeskClient,
  type FreshdeskSolutionArticle,
  type FreshdeskTicket,
  type FreshdeskConversation,
  type FreshdeskAgent,
} from "../src/lib/freshdesk";
import {
  extractSkillsFromArticles,
  extractSkillsFromTickets,
  extractGlossaryFromFreshdesk,
  groupTicketsByType,
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

// Allow callers to cap ticket processing for fast iteration without changing code.
const TICKET_CAP = Math.max(
  1,
  Number.parseInt(process.env.FRESHDESK_TICKET_CAP ?? "100", 10) || 100,
);

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

async function upsertAgentAsPerson(
  agent: FreshdeskAgent,
  resolvedTicketCount: number,
): Promise<void> {
  const slackUserId = `freshdesk-agent-${agent.id}`;
  const name = agent.contact?.name ?? null;
  const email = agent.contact?.email ?? null;
  const jobTitle = agent.contact?.job_title ?? null;
  const summary =
    resolvedTicketCount > 0
      ? `Freshdesk support agent. Last responder on ${resolvedTicketCount} tickets in the last 90 days.`
      : `Freshdesk support agent.`;

  const existing = await selectOne<{ id: string }>("people", {
    select: "id",
    workspace_id: `eq.${WORKSPACE_ID}`,
    slack_user_id: `eq.${slackUserId}`,
  });

  const payload = {
    workspace_id: WORKSPACE_ID,
    slack_user_id: slackUserId,
    display_name: name,
    real_name: name,
    title: jobTitle,
    email,
    avatar_url: agent.contact?.avatar?.avatar_url ?? null,
    is_bot: false,
    is_deleted: false,
    role_extracted: "Support",
    summary,
    tools: ["Freshdesk"],
    expertise: [] as string[],
    top_channels: [] as Array<{ slack_channel_id: string; name: string; count: number }>,
    message_count: resolvedTicketCount,
    confidence: 0.6,
    status: "active" as const,
    last_seen_at: agent.last_active_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await update("people", { id: `eq.${existing.id}` }, payload);
    console.log(`  ~ person: ${name ?? slackUserId}`);
  } else {
    const ok = await insert("people", { ...payload, first_seen_at: agent.created_at });
    if (ok) console.log(`  + person: ${name ?? slackUserId}`);
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
  console.log(`[freshdesk] ticket cap = ${TICKET_CAP}`);

  await update(
    "workspaces",
    { id: `eq.${WORKSPACE_ID}` },
    { freshdesk_status: "running", freshdesk_error: null },
  );

  // 1) Solution articles. Bumped from 12/folder to 60/folder, capped at 200 total.
  console.log("\n[articles] fetching catalogue…");
  const cats = await fd.listSolutionCategories();
  console.log(`[articles] ${cats.length} categories`);
  const perFolderArticles: Array<{ folderName: string; article: FreshdeskSolutionArticle }> = [];
  outer: for (const cat of cats.slice(0, 5)) {
    const folders = await fd.listFoldersForCategory(cat.id);
    for (const folder of folders.slice(0, 8)) {
      const articles = await fd.listArticlesInFolder(folder.id);
      for (const article of articles.slice(0, 60)) {
        perFolderArticles.push({ folderName: folder.name, article });
        if (perFolderArticles.length >= 200) break outer;
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

  // 2) Recent tickets + conversations. Bumped to 3 pages × 100, process up to TICKET_CAP.
  console.log("\n[tickets] fetching recent tickets…");
  const tickets = await fd.listRecentTickets({ perPage: 100, pages: 3 });
  console.log(`[tickets] ${tickets.length} tickets fetched`);
  const withConvos: Array<{ ticket: FreshdeskTicket; conversations: FreshdeskConversation[] }> = [];
  for (const t of tickets.slice(0, TICKET_CAP)) {
    const convos = await fd.getTicketConversations(t.id).catch(() => []);
    withConvos.push({ ticket: t, conversations: convos });
  }
  console.log(`[tickets] ${withConvos.length} tickets enriched with conversations`);

  // 3) Group by type — recurring patterns are within a type, not across.
  const byType = groupTicketsByType(withConvos);
  const typeSummary = Array.from(byType.entries())
    .map(([k, v]) => `${k}=${v.length}`)
    .join(", ");
  console.log(`[tickets] grouped by type: ${typeSummary || "(none)"}`);

  let ticketCount = 0;
  for (const [groupLabel, groupTickets] of byType.entries()) {
    if (groupTickets.length < 5) {
      console.log(`[tickets] skipping group "${groupLabel}" — only ${groupTickets.length} ticket(s)`);
      continue;
    }
    console.log(`\n[tickets:${groupLabel}] extracting from ${groupTickets.length} tickets…`);
    const skills = await extractSkillsFromTickets(fd, undefined, groupTickets, {
      groupLabel,
      convosPerTicket: 8,
    });
    console.log(`[tickets:${groupLabel}] ${skills.length} skills extracted, persisting…`);
    for (const s of skills) {
      await upsertSkill({ ...s, source: "freshdesk" });
      ticketCount++;
    }
  }

  // Fallback: if nothing was groupable (everything < 5), run one mixed batch.
  if (ticketCount === 0 && withConvos.length > 0) {
    console.log("\n[tickets] no large groups — running single mixed batch…");
    const skills = await extractSkillsFromTickets(fd, undefined, withConvos, {
      groupLabel: "mixed",
      convosPerTicket: 8,
    });
    for (const s of skills) {
      await upsertSkill({ ...s, source: "freshdesk" });
      ticketCount++;
    }
  }

  // 4) Glossary
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

  // 5) Agents → people rows. Count tickets where each agent was the last responder
  //    (proxy: tickets updated in the last 90 days). Freshdesk doesn't expose
  //    last_responder_id by default on the list endpoint, so we approximate via
  //    conversation lookups for the tickets we already pulled.
  console.log("\n[agents] fetching support agents…");
  let personCount = 0;
  try {
    const agents = await fd.listAgents({ perPage: 100, pages: 2 });
    console.log(`[agents] ${agents.length} agents found`);

    // Approximate "last responder" counts using conversations we already pulled.
    const counts = new Map<number, number>();
    for (const { conversations } of withConvos) {
      // Last outgoing (non-private) responder is the most recent agent reply.
      const lastAgentReply = [...conversations]
        .reverse()
        .find((c) => !c.incoming && !c.private && c.user_id);
      if (lastAgentReply?.user_id) {
        counts.set(lastAgentReply.user_id, (counts.get(lastAgentReply.user_id) ?? 0) + 1);
      }
    }

    for (const agent of agents) {
      const c = counts.get(agent.id) ?? 0;
      await upsertAgentAsPerson(agent, c);
      personCount++;
    }
  } catch (e) {
    console.warn(`[agents] failed: ${(e as Error).message}`);
  }

  await update(
    "workspaces",
    { id: `eq.${WORKSPACE_ID}` },
    { freshdesk_status: "done" },
  );

  console.log(
    `\n✅ Done. articles=${articleCount}, tickets=${ticketCount}, glossary=${entries.length}, agents=${personCount}`,
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
