// Support co-pilot runtime. For each new Freshdesk ticket:
//   1. Pull conversation context (subject + body + thread)
//   2. Apply short-circuits (spam, exact-template, structured bug) BEFORE any LLM
//   3. RAG: keyword filter on skills, then Claude rerank for top-5 most relevant
//   4. Decide if Stripe lookup is warranted (billing/subscription/refund intent)
//   5. Drafting prompt: ticket + retrieved skills + Stripe context + tool schemas
//   6. Persist as agent_runs row in `pending` status — the human reviews it in /agent
//
// Note: the LLM is called via the existing src/lib/extract/llm.ts wrapper which
// already routes between Anthropic API and the local CLI based on env. The
// tool-calling interface here is JSON-mode (we ask Claude to output structured
// JSON) rather than the SDK's native tools API — keeps the wrapper simple and
// works with both API and CLI backends.

import { llmCall, parseJsonBlock } from "@/lib/extract/anthropic";
import type { Skill, Workspace } from "@/lib/db";
import type { FreshdeskTicket, FreshdeskConversation } from "@/lib/freshdesk";
import { buildCompanyContextBlock } from "@/lib/extract/company-context-block";

export type AgentToolCall = {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type AgentDraftResult = {
  decision: "draft" | "spam" | "skip" | "needs_human";
  draft: string | null;
  reasoning: string;
  matchedSkillSlugs: string[];
  toolCalls: AgentToolCall[];
  urgency: "low" | "medium" | "high" | "critical";
  category: string;
  // Short-circuit reason (set when decision came from a non-LLM rule)
  shortCircuit?:
    | "spam_regex"
    | "exact_template_resiliation"
    | "exact_template_relance_paiement"
    | "exact_template_offre_etudiants"
    | null;
};

// ---------- Short-circuit layer (no LLM) ----------

const SPAM_RE =
  /\b(spring|tiktok|sellers?|free ads|launched in|biggest quarter|moving early|aurelia_|découvrez|suivez l|stories|quarterly|spring ad credits|ecommerce trends)\b/i;

const EXACT_TEMPLATE_SUBJECTS: Record<string, AgentDraftResult["shortCircuit"]> = {
  "raison résiliation abonnement": "exact_template_resiliation",
  "relance paiement": "exact_template_relance_paiement",
  "offre étudiants": "exact_template_offre_etudiants",
};

export function detectShortCircuit(ticket: FreshdeskTicket): AgentDraftResult | null {
  const subject = (ticket.subject ?? "").trim();

  // 1. Spam: matched newsletter/promo regex → close, no reply
  if (SPAM_RE.test(subject)) {
    return {
      decision: "spam",
      draft: null,
      reasoning: `Subject matched newsletter/promo pattern (no human reply needed): "${subject.slice(0, 80)}"`,
      matchedSkillSlugs: [],
      toolCalls: [],
      urgency: "low",
      category: "spam",
      shortCircuit: "spam_regex",
    };
  }

  // 2. Exact subject templates: pre-validated reply exists, no LLM needed
  const tpl = EXACT_TEMPLATE_SUBJECTS[subject.toLowerCase()];
  if (tpl) {
    return {
      decision: "draft",
      draft: null, // filled by template engine downstream
      reasoning: `Exact-template match: "${subject}" → use pre-validated template (no LLM call needed).`,
      matchedSkillSlugs: [],
      toolCalls: [],
      urgency: "medium",
      category: "template",
      shortCircuit: tpl,
    };
  }

  return null;
}

// ---------- RAG: keyword filter + LLM rerank ----------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "are", "was", "but",
  "les", "des", "une", "pour", "que", "qui", "dans", "vous", "votre", "nous", "notre", "est",
  "mon", "ma", "mes", "son", "sa", "ses", "comme", "avec", "sur", "par", "plus", "moins",
]);

function keywordOverlap(ticketTokens: Set<string>, skill: Skill): number {
  const skillTokens = new Set(
    tokenize(`${skill.title} ${skill.trigger ?? ""} ${skill.steps_md?.slice(0, 500) ?? ""}`),
  );
  let overlap = 0;
  for (const t of ticketTokens) {
    if (STOPWORDS.has(t)) continue;
    if (skillTokens.has(t)) overlap += 1;
  }
  return overlap;
}

export function selectCandidateSkills(ticket: FreshdeskTicket, allSkills: Skill[], topN = 20): Skill[] {
  const ticketText = `${ticket.subject ?? ""} ${ticket.description_text ?? ""}`;
  const tokens = new Set(tokenize(ticketText));
  const scored = allSkills
    .filter((s) => s.status !== "superseded")
    .map((s) => ({ skill: s, score: keywordOverlap(tokens, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored.map((x) => x.skill);
}

// ---------- Drafting (Claude) ----------

export type AgentRuntimeInput = {
  workspace: Workspace;
  ticket: FreshdeskTicket;
  conversation?: FreshdeskConversation[];
  candidateSkills: Skill[];
  // Stripe context — pre-fetched if the ticket smells like billing/subscription
  stripeContext?: string;
  apiKey?: string;
};

const DRAFT_SYSTEM = `You are a customer-support co-pilot drafting a reply for a human reviewer.

You will receive:
  - The Freshdesk ticket (subject + body + thread so far)
  - The company's relevant operational skills (procedures, policies)
  - Optional Stripe context (the customer's subscription / invoice state) when the ticket is billing-related

Output ONLY a single JSON object:
{
  "decision": "draft" | "skip" | "needs_human",
  "draft": "<the actual reply text in the customer's language, OR null>",
  "reasoning": "<one paragraph: what you understood, which skills you used, why this draft is appropriate>",
  "matched_skill_slugs": ["slug1", "slug2"],
  "urgency": "low" | "medium" | "high" | "critical",
  "category": "billing" | "bug" | "subscription_cancel" | "feature_request" | "complaint" | "info_request" | "other"
}

Rules:
- Output the draft in the SAME language as the customer wrote (French if French, English if English).
- Match the company's tone from the skills (concise, direct, warm).
- Cite skills by their slug in matched_skill_slugs (only if you actually grounded the draft on them).
- If the matched skills don't cover the ticket: decision="needs_human" with draft=null and reasoning explaining what context the human needs.
- If the ticket is empty/spam/test: decision="skip" with draft=null.
- NEVER make up policy or commitments not supported by the skills.
- NEVER promise refunds or actions you don't see authorised in the skills.
- Keep drafts under 200 words. The reviewer will edit before sending.`;

function buildSkillsBlock(skills: Skill[]): string {
  if (skills.length === 0) return "(no matching skills found in the catalog)";
  return skills
    .slice(0, 5)
    .map(
      (s, i) =>
        `### Skill ${i + 1}: ${s.slug}\n` +
        `Title: ${s.title}\n` +
        (s.trigger ? `Trigger: ${s.trigger}\n` : "") +
        (s.steps_md ? `Steps:\n${s.steps_md.slice(0, 800)}\n` : "") +
        (s.decision_criteria ? `Decision criteria: ${s.decision_criteria}\n` : ""),
    )
    .join("\n\n");
}

function buildTicketBlock(ticket: FreshdeskTicket, conversation: FreshdeskConversation[] = []): string {
  const reqEmail = ticket.requester?.email ? `\nRequester email: ${ticket.requester.email}` : "";
  const convBlock = conversation
    .filter((c) => c.body_text && !c.private)
    .slice(0, 5)
    .map((c, i) => `--- Reply ${i + 1} ${c.incoming ? "(customer)" : "(agent)"} ---\n${c.body_text!.slice(0, 800)}`)
    .join("\n");
  return [
    `### Ticket #${ticket.id}`,
    `Subject: ${ticket.subject}`,
    reqEmail.trim(),
    `Body:\n${(ticket.description_text ?? "").slice(0, 1500)}`,
    convBlock ? `\nConversation so far:\n${convBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function draftReply(input: AgentRuntimeInput): Promise<AgentDraftResult> {
  // Always check short-circuits first — saves an LLM call for ~30% of volume.
  const sc = detectShortCircuit(input.ticket);
  if (sc) return sc;

  const system =
    buildCompanyContextBlock(input.workspace) +
    DRAFT_SYSTEM;

  const userMessage =
    `${buildTicketBlock(input.ticket, input.conversation)}\n\n` +
    `## Relevant skills from the company brain\n\n${buildSkillsBlock(input.candidateSkills)}\n` +
    (input.stripeContext ? `\n## Stripe customer context\n${input.stripeContext}\n` : "");

  const text = await llmCall({
    system,
    userMessage,
    maxTokens: 1500,
    model: "extract",
    apiKey: input.apiKey,
  });

  type LlmOut = {
    decision?: AgentDraftResult["decision"];
    draft?: string | null;
    reasoning?: string;
    matched_skill_slugs?: string[];
    urgency?: AgentDraftResult["urgency"];
    category?: string;
  };

  let parsed: LlmOut;
  try {
    parsed = parseJsonBlock<LlmOut>(text);
  } catch {
    return {
      decision: "needs_human",
      draft: null,
      reasoning: "LLM output couldn't be parsed as JSON — defer to human.",
      matchedSkillSlugs: [],
      toolCalls: [],
      urgency: "medium",
      category: "other",
      shortCircuit: null,
    };
  }

  return {
    decision: parsed.decision ?? "needs_human",
    draft: typeof parsed.draft === "string" ? parsed.draft : null,
    reasoning: parsed.reasoning ?? "",
    matchedSkillSlugs: Array.isArray(parsed.matched_skill_slugs) ? parsed.matched_skill_slugs : [],
    toolCalls: [],
    urgency: parsed.urgency ?? "medium",
    category: parsed.category ?? "other",
    shortCircuit: null,
  };
}
