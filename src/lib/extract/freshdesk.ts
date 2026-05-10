// Extract executable skills + glossary from Freshdesk solution articles + tickets.
// Solution articles are explicit knowledge (well-structured procedures).
// Tickets carry tribal knowledge (decisions, escalations) — same shape as Slack
// extraction, but with ticket id as the citation identifier.

import { llmCall, parseJsonBlock } from "./anthropic";
import { buildCompanyContextBlock, type CompanyContextWorkspace } from "./company-context-block";
import {
  FreshdeskClient,
  type FreshdeskSolutionArticle,
  type FreshdeskTicket,
  type FreshdeskConversation,
} from "@/lib/freshdesk";

export type FreshdeskExtractedSkill = {
  type: "process" | "policy" | "decision" | "escalation";
  domain: string;
  slug: string;
  title: string;
  trigger: string;
  steps_md: string;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet?: string; url?: string }>;
};

const ARTICLE_SYSTEM = `You are extracting AGENT-EXECUTABLE SKILLS from a Freshdesk solution article.

A solution article is an internal knowledge-base entry (often a how-to or policy). One article frequently encodes MULTIPLE atomic policies — e.g. a "Refunds FAQ" article likely contains separate skills for "refund within 14 days", "refund 14-30 days needs manager", "refund for faulty product". Split them.

Output ONLY JSON. Either:
  {"skip": true}             // article is purely informational / no executable skill
  OR
  {"skills": [ {...}, {...} ]}  // 1-3 atomic skills extracted from the article

Each skill object:
{
  "type": "process" | "policy" | "decision" | "escalation",
  "domain": "support" | "billing" | "ops" | "product" | "eng" | "other",
  "slug": "kebab-case-max-6-words",
  "title": "Imperative — Handle X / Approve Y / Escalate Z",
  "trigger": "When <specific customer ask> ...",
  "steps_md": "1. ...\\n2. ...",
  "decision_criteria": "Concrete if/then with NUMBERS (dollar thresholds, day windows, tier names) and TOOL NAMES. null if N/A.",
  "escalation": "Who decides + when. null if N/A.",
  "supporting_quotes": ["short quote 1", "short quote 2"]   // 1-3 quotes, max 200 chars each, lifted verbatim from article
}

Hard rules:
- REJECT skills that just rephrase the article title with no actionable content. The trigger must include the EXACT customer ask ("When a customer asks for a refund and the order is between 14 and 30 days old…") not vague "When a customer has a refund question".
- For type=policy, decision_criteria MUST contain concrete thresholds (numbers, day windows, customer tiers, plan names) lifted from the article. If the article has no thresholds, set type=process instead.
- Slugs must be unique within your output array. Don't emit two skills with the same slug.
- If the article body is mostly marketing copy / definitions / no procedure, output {"skip": true}.
- Don't invent thresholds the article doesn't state. Faithful extraction only.`;

const TICKETS_SYSTEM = `You are extracting AGENT-EXECUTABLE SKILLS from a batch of Freshdesk support tickets and their conversations.

Look for RECURRING decisions across tickets — patterns the support team repeats. Three things to hunt for specifically:

  1. THRESHOLDS — numeric rules that gate a decision: dollar amounts ("refund up to $50 without approval"), time windows ("within 14 days of purchase"), customer tiers ("Pro plan customers", "VIP / $50K+ ACV"), severity levels.
  2. ESCALATION PATHS — who decides what: which named human or team gets pinged for which class of problem ("billing disputes → Diego", "outages → on-call channel + cc CTO").
  3. TYPE-ROUTING — which kind of ticket goes to which queue/team based on subject keywords, tags, or product area.

Don't extract one-off ticket details. A skill is only valuable if the same shape of decision shows up in 2+ tickets in the batch.

Output ONLY JSON, an array of skill objects (max 8). Each object:
{
  "type": "process" | "policy" | "decision" | "escalation",
  "domain": "support" | "billing" | "ops" | "product" | "eng" | "other",
  "slug": "kebab-case",
  "title": "Imperative",
  "trigger": "When <specific customer scenario> ...",
  "steps_md": "1. ...\\n2. ...",
  "decision_criteria": "Concrete if/then with NUMBERS / NAMES / TOOLS, or null",
  "escalation": "Named human or team + when, or null",
  "citation_ticket_ids": [12, 34]   // REQUIRED, non-empty, ticket IDs that motivated this skill
}

Hard rules:
- citation_ticket_ids MUST be non-empty AND every ID must come from the input batch. Skills without grounded citations will be discarded.
- Reject skills with vague triggers ("When a customer has an issue"). Specificity wins.
- Prefer skills with concrete numbers / named humans / named tools. A skill saying "refund up to $50 without manager approval; $50-$200 needs Sarah; over $200 needs Marc" is worth ten generic skills.
- If nothing recurring is observable in this batch, output [].`;

function articleToText(article: FreshdeskSolutionArticle, folderName: string): string {
  return [
    `Folder: ${folderName}`,
    `Title: ${article.title}`,
    "",
    article.description_text ?? "(no body)",
  ].join("\n");
}

type ParsedArticleSkill = {
  type?: FreshdeskExtractedSkill["type"];
  domain?: string;
  slug?: string;
  title?: string;
  trigger?: string;
  steps_md?: string;
  decision_criteria?: string | null;
  escalation?: string | null;
  supporting_quotes?: string[];
};

export async function extractSkillsFromArticles(
  fd: FreshdeskClient,
  apiKey: string | undefined,
  perFolderArticles: Array<{ folderName: string; article: FreshdeskSolutionArticle }>,
  companyContext?: CompanyContextWorkspace | null,
): Promise<FreshdeskExtractedSkill[]> {
  const out: FreshdeskExtractedSkill[] = [];
  for (const { folderName, article } of perFolderArticles) {
    if (!article.description_text || article.description_text.length < 80) continue;
    const text = await llmCall({
      system: buildCompanyContextBlock(companyContext) + ARTICLE_SYSTEM,
      userMessage: articleToText(article, folderName),
      maxTokens: 2500,
      model: "extract",
      apiKey,
    });

    let raw: unknown = null;
    try {
      raw = parseJsonBlock(text);
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object") continue;

    // Two accepted shapes: {skip:true} | {skills:[...]} | (legacy) single skill object.
    const obj = raw as Record<string, unknown>;
    if (obj.skip === true) continue;

    let skills: ParsedArticleSkill[] = [];
    if (Array.isArray(obj.skills)) {
      skills = obj.skills as ParsedArticleSkill[];
    } else if (Array.isArray(raw)) {
      skills = raw as ParsedArticleSkill[];
    } else if (obj.slug && obj.title) {
      // Legacy single-skill shape — wrap it.
      skills = [obj as ParsedArticleSkill];
    } else {
      continue;
    }

    const seenSlugs = new Set<string>();
    for (const parsed of skills.slice(0, 3)) {
      if (
        !parsed ||
        !parsed.type ||
        !parsed.slug ||
        !parsed.title ||
        !parsed.trigger ||
        !parsed.steps_md
      ) {
        continue;
      }
      // Reject skills that just paraphrase the article title (no added value).
      const titleStripped = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const skillStripped = parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (titleStripped && skillStripped === titleStripped && !parsed.decision_criteria) {
        continue;
      }
      if (seenSlugs.has(parsed.slug)) continue;
      seenSlugs.add(parsed.slug);

      const url = fd.articleUrl(article.id);
      const citations: FreshdeskExtractedSkill["citations"] = [
        {
          channel_id: `freshdesk-article-${article.id}`,
          ts: article.updated_at,
          snippet: article.title.slice(0, 200),
          url,
        },
      ];
      if (parsed.supporting_quotes) {
        for (const q of parsed.supporting_quotes.slice(0, 2)) {
          if (typeof q !== "string") continue;
          citations.push({
            channel_id: `freshdesk-article-${article.id}`,
            ts: article.updated_at,
            snippet: q.slice(0, 200),
            url,
          });
        }
      }

      out.push({
        type: parsed.type,
        domain: parsed.domain || "support",
        slug: parsed.slug,
        title: parsed.title,
        trigger: parsed.trigger,
        steps_md: parsed.steps_md,
        decision_criteria: parsed.decision_criteria ?? null,
        escalation: parsed.escalation ?? null,
        citations,
      });
    }
  }
  return out;
}

type ParsedTicketSkill = {
  type?: FreshdeskExtractedSkill["type"];
  domain?: string;
  slug?: string;
  title?: string;
  trigger?: string;
  steps_md?: string;
  decision_criteria?: string | null;
  escalation?: string | null;
  citation_ticket_ids?: number[];
};

export async function extractSkillsFromTickets(
  fd: FreshdeskClient,
  apiKey: string | undefined,
  tickets: Array<{ ticket: FreshdeskTicket; conversations: FreshdeskConversation[] }>,
  opts: { groupLabel?: string; convosPerTicket?: number } = {},
  companyContext?: CompanyContextWorkspace | null,
): Promise<FreshdeskExtractedSkill[]> {
  if (tickets.length === 0) return [];

  const convosPerTicket = opts.convosPerTicket ?? 8;
  const userMsg = tickets
    .slice(0, 30)
    .map(({ ticket, conversations }) => {
      const convo = conversations
        .filter((c) => c.body_text && !c.private)
        .slice(0, convosPerTicket)
        .map((c, i) => `      ${i + 1}. ${c.body_text!.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n");
      return [
        `### Ticket #${ticket.id}: ${ticket.subject}`,
        `Status=${ticket.status} Priority=${ticket.priority} Type=${ticket.type ?? "?"}`,
        `Description: ${(ticket.description_text ?? "").replace(/\s+/g, " ").slice(0, 400)}`,
        `Conversation excerpts:\n${convo || "(none)"}`,
      ].join("\n");
    })
    .join("\n\n");

  const header = opts.groupLabel
    ? `Extract recurring skills from these ${Math.min(30, tickets.length)} tickets (group: ${opts.groupLabel}):`
    : `Extract recurring skills from these ${Math.min(30, tickets.length)} tickets:`;

  const text = await llmCall({
    system: buildCompanyContextBlock(companyContext) + TICKETS_SYSTEM,
    userMessage: `${header}\n\n${userMsg}`,
    maxTokens: 4500,
    model: "extract",
    apiKey,
  });

  let parsed: ParsedTicketSkill[] = [];
  try {
    const raw = parseJsonBlock<unknown>(text);
    if (Array.isArray(raw)) parsed = raw as ParsedTicketSkill[];
    else if (raw && typeof raw === "object" && Array.isArray((raw as { skills?: unknown }).skills)) {
      parsed = (raw as { skills: ParsedTicketSkill[] }).skills;
    }
  } catch {
    return [];
  }

  const ticketById = new Map(tickets.map((t) => [t.ticket.id, t.ticket]));
  const out: FreshdeskExtractedSkill[] = [];
  for (const p of parsed.slice(0, 8)) {
    if (!p.type || !p.slug || !p.title || !p.trigger || !p.steps_md) continue;
    const tids = (p.citation_ticket_ids ?? []).filter((id) => ticketById.has(id));
    // Hard requirement: citations must be present and grounded in the input batch.
    if (tids.length === 0) continue;

    const citations: FreshdeskExtractedSkill["citations"] = [];
    for (const tid of tids.slice(0, 5)) {
      const t = ticketById.get(tid);
      if (!t) continue;
      citations.push({
        channel_id: `freshdesk-ticket-${t.id}`,
        ts: t.updated_at,
        snippet: t.subject.slice(0, 200),
        url: fd.ticketUrl(t.id),
      });
    }
    out.push({
      type: p.type,
      domain: p.domain || "support",
      slug: p.slug,
      title: p.title,
      trigger: p.trigger,
      steps_md: p.steps_md,
      decision_criteria: p.decision_criteria ?? null,
      escalation: p.escalation ?? null,
      citations,
    });
  }
  return out;
}

const GLOSSARY_SYSTEM = `You are extracting domain-specific terms (acronyms, jargon, internal product names) from Freshdesk content.

Output ONLY JSON, an array. Each entry: {"term": "ABC", "definition": "...", "category": "acronym|jargon|product"}.
Skip generic English. Skip terms <2 chars. Definition should be 1 sentence, company-specific.
Max 15 entries.`;

export async function extractGlossaryFromFreshdesk(
  apiKey: string | undefined,
  texts: string[],
  companyContext?: CompanyContextWorkspace | null,
): Promise<Array<{ term: string; definition: string; category: string }>> {
  if (texts.length === 0) return [];
  const blob = texts.slice(0, 30).map((t) => t.slice(0, 1500)).join("\n---\n");
  const text = await llmCall({
    system: buildCompanyContextBlock(companyContext) + GLOSSARY_SYSTEM,
    userMessage: `Extract terms:\n\n${blob}`,
    maxTokens: 2048,
    model: "extract",
    apiKey,
  });
  try {
    const parsed = parseJsonBlock<Array<{ term?: string; definition?: string; category?: string }>>(text);
    return parsed
      .filter((p) => p.term && p.definition)
      .map((p) => ({
        term: p.term!,
        definition: p.definition!,
        category: p.category || "jargon",
      }))
      .slice(0, 15);
  } catch {
    return [];
  }
}

export type FreshdeskAgent = {
  id: number;
  contact?: { name?: string; email?: string };
};

/**
 * Group tickets by their `type` field. Null/empty types fall under "general".
 * Used to run focused per-type LLM extractions instead of one mixed batch.
 */
export function groupTicketsByType<
  T extends { ticket: FreshdeskTicket; conversations: FreshdeskConversation[] },
>(tickets: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of tickets) {
    const key = (t.ticket.type ?? "").trim() || "general";
    const arr = out.get(key) ?? [];
    arr.push(t);
    out.set(key, arr);
  }
  return out;
}
