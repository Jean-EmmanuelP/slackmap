// Early-warning analyzer for Freshdesk tickets. Pulls recent tickets via the
// FreshdeskClient, asks Anthropic Haiku to classify each one against the
// workspace's known skills, and persists "signals" — tickets that warrant
// dev/ops attention. Phase 1 of the progressive Freshdesk replacement
// strategy: observe + flag today, draft replies tomorrow.

import { llmCall, parseJsonBlock } from "@/lib/extract/anthropic";
import { FreshdeskClient, type FreshdeskTicket } from "@/lib/freshdesk";

export type SignalCategory =
  | "complaint"
  | "bug"
  | "unknown_intent"
  | "sentiment_negative"
  | "spike"
  | "churn_risk"
  | "other";

export type SignalUrgency = "low" | "medium" | "high" | "critical";

export type AnalyzedSignal = {
  ticketId: number;
  ticketSubject: string;
  ticketUrl: string;
  urgency: SignalUrgency;
  category: SignalCategory;
  reason: string;
  matchedSkillSlug: string | null;
  matchedSkillConfidence: number | null;
  // WHO + WHEN context — minimum needed for the brain to reason about
  // patterns over time. Not a Freshdesk inbox replica.
  requesterEmail: string | null;
  ticketCreatedAt: string | null;
  ticketPriority: number | null;
};

export type SkillCatalogEntry = {
  slug: string;
  title: string;
  trigger: string | null;
};

const ANALYZE_SYSTEM = `You are an early-warning system for a customer-support queue. You score each ticket against the company's known procedures (skills) and flag the ones that warrant immediate attention.

Output ONLY a JSON array, one object per input ticket, in the same order:
[
  {
    "ticket_id": <number>,
    "urgency": "low" | "medium" | "high" | "critical",
    "category": "complaint" | "bug" | "unknown_intent" | "sentiment_negative" | "spike" | "churn_risk" | "other",
    "reason": "<one sentence — concrete, references the ticket text>",
    "matched_skill_slug": "<slug-or-null>",
    "matched_skill_confidence": <0..1 or null>
  },
  ...
]

Scoring rules:
- urgency=critical: outage, mass-impact bug, legal/compliance threat, immediate cancellation
- urgency=high: angry customer, repeat issue, churn risk, paying-customer blocker
- urgency=medium: normal bug report, billing question, integration issue
- urgency=low: how-to, info request, kind feedback, easily auto-replied

- category=complaint: explicit dissatisfaction or anger
- category=bug: defect / regression report
- category=unknown_intent: doesn't match any known skill — new pattern
- category=sentiment_negative: frustrated / aggressive language even if not a complaint
- category=churn_risk: mentions cancellation, refund, switching
- category=spike: topic that's appearing more than the baseline (you can't see baseline; only flag if ticket itself screams "another one")
- category=other: legit but uninteresting

- matched_skill_slug: the slug of the skill that BEST handles this ticket (from the catalog provided). null if nothing matches well.
- matched_skill_confidence: 0..1 — how confident the matched skill applies. null if no match.

Be sober: not every ticket is "high". Default to medium unless evidence pushes it. Include EVERY input ticket in the output.`;

function buildSkillCatalog(skills: SkillCatalogEntry[]): string {
  if (skills.length === 0) return "(no skills extracted yet — every ticket is unknown_intent)";
  return skills
    .slice(0, 60) // cap context size
    .map((s) => `  - ${s.slug}: ${s.title}${s.trigger ? ` (trigger: ${s.trigger.slice(0, 100)})` : ""}`)
    .join("\n");
}

function buildTicketBlock(t: FreshdeskTicket): string {
  return [
    `### Ticket #${t.id}`,
    `Subject: ${t.subject}`,
    `Status=${t.status} Priority=${t.priority} Type=${t.type ?? "?"}`,
    `Body: ${(t.description_text ?? "").replace(/\s+/g, " ").slice(0, 600)}`,
  ].join("\n");
}

export async function analyzeFreshdeskTickets({
  fd,
  apiKey,
  tickets,
  skillCatalog,
}: {
  fd: FreshdeskClient;
  apiKey?: string;
  tickets: FreshdeskTicket[];
  skillCatalog: SkillCatalogEntry[];
}): Promise<AnalyzedSignal[]> {
  if (tickets.length === 0) return [];

  // Batch in groups of 15 to keep the prompt manageable.
  const batches: FreshdeskTicket[][] = [];
  for (let i = 0; i < tickets.length; i += 15) {
    batches.push(tickets.slice(i, i + 15));
  }

  const out: AnalyzedSignal[] = [];

  for (const batch of batches) {
    const userMessage =
      `Known skills catalog (use these slugs for matched_skill_slug):\n${buildSkillCatalog(skillCatalog)}\n\n` +
      `Tickets to score:\n\n${batch.map(buildTicketBlock).join("\n\n")}`;

    const text = await llmCall({
      system: ANALYZE_SYSTEM,
      userMessage,
      maxTokens: 4096,
      model: "classify",
      apiKey,
    });

    let parsed: Array<{
      ticket_id?: number;
      urgency?: SignalUrgency;
      category?: SignalCategory;
      reason?: string;
      matched_skill_slug?: string | null;
      matched_skill_confidence?: number | null;
    }>;
    try {
      parsed = parseJsonBlock(text);
    } catch {
      continue;
    }

    const ticketById = new Map(batch.map((t) => [t.id, t]));
    for (const p of parsed) {
      const t = p.ticket_id !== undefined ? ticketById.get(p.ticket_id) : undefined;
      if (!t || !p.urgency || !p.category || !p.reason) continue;
      out.push({
        ticketId: t.id,
        ticketSubject: t.subject,
        ticketUrl: fd.ticketUrl(t.id),
        urgency: p.urgency,
        category: p.category,
        reason: p.reason,
        matchedSkillSlug: p.matched_skill_slug ?? null,
        matchedSkillConfidence:
          typeof p.matched_skill_confidence === "number" ? p.matched_skill_confidence : null,
        requesterEmail: t.requester?.email ?? null,
        ticketCreatedAt: t.created_at ?? null,
        ticketPriority: typeof t.priority === "number" ? t.priority : null,
      });
    }
  }

  return out;
}
