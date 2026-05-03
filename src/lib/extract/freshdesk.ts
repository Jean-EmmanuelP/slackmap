// Extract executable skills + glossary from Freshdesk solution articles + tickets.
// Solution articles are explicit knowledge (well-structured procedures).
// Tickets carry tribal knowledge (decisions, escalations) — same shape as Slack
// extraction, but with ticket id as the citation identifier.

import { llmCall, parseJsonBlock } from "./anthropic";
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

A solution article is an internal knowledge-base entry (often a how-to or policy). Convert it into a single skill the AI agent can actually execute:

Rules:
- ONE skill per article (or skip with {"skip":true} if it's purely informational).
- "type": process | policy | decision | escalation. Default to process.
- "domain": "support" | "billing" | "ops" | "product" | "eng" | "other".
- "slug": kebab-case, max 6 words.
- "title": imperative, "Handle X" / "Approve Y" / "Escalate Z".
- "trigger": one sentence "When ...".
- "steps_md": numbered markdown list, copying or summarizing the article's actual steps.
- "decision_criteria": multi-line if/then rules. null if N/A.
- "escalation": who/when. null if N/A.
- "supporting_quotes": 1-3 short quotes from the article (max 200 chars each).

Output ONLY JSON: {"skip":true} OR a single skill object (NOT an array).`;

const TICKETS_SYSTEM = `You are extracting AGENT-EXECUTABLE SKILLS from recent Freshdesk support tickets and their conversations.

Look for RECURRING decisions, escalation rules, refund thresholds, routing logic — knowledge that's tribal but consistent across tickets. Don't extract one-off ticket details.

Output a JSON array of skill objects (max 5). Each object:
{
  "type": "process|policy|decision|escalation",
  "domain": "support|billing|ops|product|eng|other",
  "slug": "kebab-case",
  "title": "imperative",
  "trigger": "When ...",
  "steps_md": "1. ...\\n2. ...",
  "decision_criteria": "if/then" or null,
  "escalation": "who/when" or null,
  "citation_ticket_ids": [12, 34]   // ticket IDs that motivated this skill
}

If nothing recurring is observable, output [].`;

function articleToText(article: FreshdeskSolutionArticle, folderName: string): string {
  return [
    `Folder: ${folderName}`,
    `Title: ${article.title}`,
    "",
    article.description_text ?? "(no body)",
  ].join("\n");
}

export async function extractSkillsFromArticles(
  fd: FreshdeskClient,
  apiKey: string | undefined,
  perFolderArticles: Array<{ folderName: string; article: FreshdeskSolutionArticle }>,
): Promise<FreshdeskExtractedSkill[]> {
  const out: FreshdeskExtractedSkill[] = [];
  for (const { folderName, article } of perFolderArticles) {
    if (!article.description_text || article.description_text.length < 80) continue;
    const text = await llmCall({
      system: ARTICLE_SYSTEM,
      userMessage: articleToText(article, folderName),
      maxTokens: 1500,
      model: "extract",
      apiKey,
    });
    let parsed: {
      skip?: boolean;
      type?: FreshdeskExtractedSkill["type"];
      domain?: string;
      slug?: string;
      title?: string;
      trigger?: string;
      steps_md?: string;
      decision_criteria?: string | null;
      escalation?: string | null;
      supporting_quotes?: string[];
    } | null = null;
    try {
      parsed = parseJsonBlock(text);
    } catch {
      continue;
    }
    if (!parsed || parsed.skip) continue;
    if (!parsed.type || !parsed.slug || !parsed.title || !parsed.trigger || !parsed.steps_md) continue;

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
  return out;
}

export async function extractSkillsFromTickets(
  fd: FreshdeskClient,
  apiKey: string | undefined,
  tickets: Array<{ ticket: FreshdeskTicket; conversations: FreshdeskConversation[] }>,
): Promise<FreshdeskExtractedSkill[]> {
  if (tickets.length === 0) return [];

  const userMsg = tickets
    .slice(0, 30)
    .map(({ ticket, conversations }) => {
      const convo = conversations
        .filter((c) => c.body_text && !c.private)
        .slice(0, 4)
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

  const text = await llmCall({
    system: TICKETS_SYSTEM,
    userMessage: `Extract recurring skills from these ${Math.min(30, tickets.length)} tickets:\n\n${userMsg}`,
    maxTokens: 3500,
    model: "extract",
    apiKey,
  });

  let parsed: Array<{
    type?: FreshdeskExtractedSkill["type"];
    domain?: string;
    slug?: string;
    title?: string;
    trigger?: string;
    steps_md?: string;
    decision_criteria?: string | null;
    escalation?: string | null;
    citation_ticket_ids?: number[];
  }> = [];
  try {
    parsed = parseJsonBlock(text);
  } catch {
    return [];
  }

  const ticketById = new Map(tickets.map((t) => [t.ticket.id, t.ticket]));
  const out: FreshdeskExtractedSkill[] = [];
  for (const p of parsed.slice(0, 5)) {
    if (!p.type || !p.slug || !p.title || !p.trigger || !p.steps_md) continue;
    const citations: FreshdeskExtractedSkill["citations"] = [];
    for (const tid of (p.citation_ticket_ids ?? []).slice(0, 5)) {
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
): Promise<Array<{ term: string; definition: string; category: string }>> {
  if (texts.length === 0) return [];
  const blob = texts.slice(0, 30).map((t) => t.slice(0, 1500)).join("\n---\n");
  const text = await llmCall({
    system: GLOSSARY_SYSTEM,
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
