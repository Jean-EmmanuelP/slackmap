import { llmCall, parseJsonBlock } from "./anthropic";

type Msg = { ts: string; user?: string; text?: string };

// Patterns that often precede procedural/policy knowledge in Slack.
// We use these to pre-filter messages worth sending to the LLM, vs scanning
// every message (which would be expensive and noisy).
const PROCEDURAL_PATTERNS = [
  // English
  /\bwe (decided|agreed|will|should|always|never)\b/i,
  /\b(let'?s|let us) (do|always|go with|standardize|stick to)\b/i,
  /\b(the|our) (process|policy|rule|procedure|approach|standard)\b/i,
  /\b(when|if|whenever) .{1,80} (then|do|please|make sure)\b/i,
  /\b(to|in order to) .{1,40}(?:,| you (?:need|must|should))/i,
  /\b(going forward|from now on|next time|moving forward)\b/i,
  /\b(escalat\w+|handoff|on[- ]call|incident|post[- ]?mortem)\b/i,
  /\b(refund|exception|approval|sign[- ]?off|threshold)\b/i,
  /\b(playbook|runbook|sop)\b/i,

  // French
  /\bon (a décidé|décide|doit|va|devrait|fait toujours|fait jamais)\b/i,
  /\b(il faut|il faudrait|il faudra) (que|absolument|toujours|jamais)\b/i,
  /\b(la|notre|le) (procédure|processus|règle|protocole|politique|approche|standard|méthode)\b/i,
  /\b(quand|si|lorsque|dès que) .{1,80} (alors|on|il faut|merci de)\b/i,
  /\bpour .{1,40}(?:,| il faut| tu dois| vous devez)/i,
  /\b(à partir de maintenant|désormais|à l'?avenir|la prochaine fois|dorénavant)\b/i,
  /\b(escalad\w+|escalat\w+|astreinte|incident|post[- ]?mortem|bilan)\b/i,
  /\b(remboursement|rembourser|exception|validation|seuil|approbation)\b/i,
  /\b(faut valider|à valider|merci de|valid\w+ par)\b/i,
];

export type ProceduralSeed = {
  ts: string;
  text: string;
  triggeredBy: string; // which pattern matched (for debugging)
};

export function findProceduralSeeds(messages: Msg[]): ProceduralSeed[] {
  const seeds: ProceduralSeed[] = [];
  for (const m of messages) {
    if (!m.text || m.text.length < 30) continue;
    for (const pat of PROCEDURAL_PATTERNS) {
      const match = m.text.match(pat);
      if (match) {
        seeds.push({ ts: m.ts, text: m.text.slice(0, 600), triggeredBy: match[0] });
        break;
      }
    }
  }
  return seeds;
}

const EXTRACT_SYSTEM = `You read Slack messages from a single channel and extract any
recurring procedures, policies, or decision rules that an AI agent could execute
on behalf of the company.

For each candidate, output a SkillSpec OR set "skip": true if it's not a real
procedure (just chitchat, one-off requests, etc.).

Output JSON only — an array, one entry per input candidate, in the same order:

[
  {
    "skip": false,
    "type": "process" | "policy" | "decision" | "escalation",
    "domain": "engineering" | "product" | "support" | "ops" | "sales" | "marketing" | "leadership" | "other",
    "slug": "kebab-case-id",
    "title": "Title in natural english (max 60 chars)",
    "trigger": "When this skill should activate (1 sentence)",
    "steps_md": "Numbered markdown list of steps. Be specific. Use real names if mentioned.",
    "decision_criteria": "If/then logic. null if N/A.",
    "escalation": "When to escalate, to whom. null if N/A.",
    "supporting_quotes": ["short quote 1", "short quote 2"]
  },
  { "skip": true },
  ...
]

Hard rules:
- Skip if it's a one-off question, a complaint, a personal opinion, or social chat.
- Skip if it's only a reference to an external doc without explaining the procedure.
- Be FAITHFUL to the source — don't invent steps that aren't grounded in the messages.
- Keep slug lowercase-kebab. Title in plain english.
- An AI agent will read steps_md and act. Be unambiguous and complete.`;

export type ExtractedSkill = {
  type: "process" | "policy" | "decision" | "escalation";
  domain: string;
  slug: string;
  title: string;
  trigger: string;
  steps_md: string;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet: string }>;
};

// Group seeds with their surrounding messages (parent thread or +/- 5 msgs)
// to give the LLM context. Returns clusters of {seed, contextMsgs}.
function buildContexts(seeds: ProceduralSeed[], allMessages: Msg[]): Array<{ seed: ProceduralSeed; context: Msg[] }> {
  const tsToIdx = new Map(allMessages.map((m, i) => [m.ts, i]));
  return seeds.slice(0, 30).map((seed) => {
    const idx = tsToIdx.get(seed.ts) ?? -1;
    const context: Msg[] = [];
    if (idx >= 0) {
      for (let i = Math.max(0, idx - 3); i <= Math.min(allMessages.length - 1, idx + 5); i++) {
        const m = allMessages[i];
        if (m.text) context.push(m);
      }
    } else {
      context.push({ ts: seed.ts, text: seed.text });
    }
    return { seed, context };
  });
}

export async function extractSkillsFromChannel(
  channelId: string,
  channelName: string,
  messages: Msg[],
  apiKey?: string,
): Promise<ExtractedSkill[]> {
  const seeds = findProceduralSeeds(messages);
  if (seeds.length === 0) return [];

  const contexts = buildContexts(seeds, messages);

  const userMsg = contexts
    .map(
      (c, i) =>
        `### Candidate ${i + 1}\n` +
        `Trigger phrase that matched: "${c.seed.triggeredBy}"\n` +
        `Surrounding messages:\n` +
        c.context.map((m) => `- ${m.text!.replace(/\s+/g, " ").slice(0, 400)}`).join("\n"),
    )
    .join("\n\n");

  const text = await llmCall({
    system: EXTRACT_SYSTEM,
    userMessage:
      `Channel: #${channelName}\n\n` +
      `Extract executable skills from these ${contexts.length} candidates:\n\n${userMsg}`,
    maxTokens: 4096,
    model: "extract",
    apiKey,
  });

  let parsed: Array<{
    skip?: boolean;
    type?: ExtractedSkill["type"];
    domain?: string;
    slug?: string;
    title?: string;
    trigger?: string;
    steps_md?: string;
    decision_criteria?: string | null;
    escalation?: string | null;
    supporting_quotes?: string[];
  }>;
  try {
    parsed = parseJsonBlock(text);
  } catch {
    return [];
  }

  const out: ExtractedSkill[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const ctx = contexts[i];
    if (!p || p.skip || !p.type || !p.slug || !p.title || !p.trigger || !p.steps_md || !ctx) continue;

    // Build citations from the seed + supporting quotes (best effort match by snippet).
    const citations: ExtractedSkill["citations"] = [
      { channel_id: channelId, ts: ctx.seed.ts, snippet: ctx.seed.text.slice(0, 200) },
    ];
    if (p.supporting_quotes) {
      for (const quote of p.supporting_quotes.slice(0, 3)) {
        const m = ctx.context.find((cm) => cm.text?.includes(quote.slice(0, 40)));
        if (m && m.ts !== ctx.seed.ts) {
          citations.push({ channel_id: channelId, ts: m.ts, snippet: m.text!.slice(0, 200) });
        }
      }
    }

    out.push({
      type: p.type,
      domain: p.domain || "other",
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

// Render a skill as a Claude-compatible markdown file (frontmatter + body).
// This is what gets included in the exported skill bundle.
export function renderSkillMarkdown(skill: {
  slug: string;
  title: string;
  type: string;
  trigger: string | null;
  steps_md: string | null;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet?: string }>;
  confidence: number;
  source_count: number;
  last_observed_at: string | null;
  workspace_team_domain: string | null;
}): string {
  const description =
    skill.trigger ??
    `${skill.type[0].toUpperCase()}${skill.type.slice(1)}: ${skill.title}`;
  const lines: string[] = [];
  lines.push("---");
  lines.push(`name: ${skill.slug}`);
  lines.push(`description: ${escapeFrontmatter(description)}`);
  lines.push(`type: ${skill.type}`);
  lines.push(`confidence: ${skill.confidence.toFixed(2)}`);
  lines.push(`sources: ${skill.source_count}`);
  if (skill.last_observed_at) lines.push(`last_observed: ${skill.last_observed_at.split("T")[0]}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${skill.title}`);
  lines.push("");
  if (skill.trigger) {
    lines.push("## Trigger");
    lines.push("");
    lines.push(skill.trigger);
    lines.push("");
  }
  if (skill.steps_md) {
    lines.push("## Steps");
    lines.push("");
    lines.push(skill.steps_md);
    lines.push("");
  }
  if (skill.decision_criteria) {
    lines.push("## Decision criteria");
    lines.push("");
    lines.push(skill.decision_criteria);
    lines.push("");
  }
  if (skill.escalation) {
    lines.push("## Escalation");
    lines.push("");
    lines.push(skill.escalation);
    lines.push("");
  }
  if (skill.citations.length > 0) {
    lines.push("## Sources");
    lines.push("");
    for (const c of skill.citations) {
      const link = skill.workspace_team_domain
        ? `https://${skill.workspace_team_domain}.slack.com/archives/${c.channel_id}/p${c.ts.replace(".", "")}`
        : null;
      const label = c.snippet ? c.snippet.slice(0, 120).replace(/\s+/g, " ") + "…" : c.ts;
      lines.push(link ? `- [${label}](${link})` : `- ${label} (${c.channel_id} @ ${c.ts})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeFrontmatter(s: string): string {
  // YAML frontmatter description: keep on a single line, escape quotes.
  return s.replace(/\n+/g, " ").replace(/"/g, '\\"').slice(0, 280);
}

// =====================================================================
// People → Skills extraction.
//
// Channel-based skill extraction often finds 0 procedures in informal /
// French / small-company Slacks because messages don't match procedural
// regex patterns. So we derive skills from extracted PEOPLE PROFILES too:
// for each person with a clear role, generate the 1-3 executable
// responsibilities they own. Anchored in evidence (role + expertise +
// tools observed), not invented.
// =====================================================================

const PERSON_SKILLS_SYSTEM = `You build the "company brain" for an organization
— the missing layer between raw company data and reliable AI automation. Your
job is to extract the domain knowledge that LIVES IN THIS PERSON'S HEAD and
make it executable.

This person has accumulated tacit know-how about how the company actually
operates. That knowledge currently exists only in their head and in scattered
Slack threads. You convert it into AI-executable skill files.

For each major responsibility this person owns, generate ONE skill that captures
the procedure / decision / policy they apply. An AI agent should be able to load
this skill and execute the work on their behalf — safely, consistently, with
the same judgment this person would apply.

Output ONLY a JSON array. 1 to 3 skills — only the most clearly grounded. If
you can't anchor a skill in the observable signals (role, tools, expertise,
channels), skip it. Don't invent.

[
  {
    "type": "process" | "policy" | "decision" | "escalation",
    "domain": "engineering" | "product" | "support" | "ops" | "sales" | "marketing" | "leadership" | "other",
    "slug": "kebab-case-id",
    "title": "Action-oriented title (max 60 chars) — describes what the AI would EXECUTE",
    "trigger": "When this skill should activate (1 sentence, observable signal)",
    "steps_md": "Numbered markdown steps. Specific. Reference the actual tools they use. An AI should be able to follow these without ambiguity.",
    "decision_criteria": "The if/then logic this person applies. null if N/A.",
    "escalation": "When to bring a human in / who to escalate to. null if N/A."
  }
]

Domain definitions:
- engineering: code, infra, deploys, incidents, devops, backend/frontend
- product: roadmap, feature design, UX, research
- support: customer bugs, refunds, escalations to eng, response SLAs
- ops: payroll, hiring, finance, legal, contractor management, internal tools
- sales: deals, pricing, contract negotiation, account management
- marketing: launches, content, growth, campaigns
- leadership: strategy, fundraising, exec hiring, board comms
- other: only if truly none of the above

Hard rules:
- Skip if role is "Bot", "unknown", or signal is too thin.
- Title is a VERB phrase ("Handle a customer refund", not "Customer Support Lead").
- Steps cite the actual SaaS tools they use (Stripe, Linear, Notion, Zendesk…).
- Steps should encode the JUDGMENT calls this person makes — that's the value.
- Faithful to the evidence. No inventing details not implied by the profile.`;

export type PersonSkillInput = {
  role: string;
  summary: string | null;
  tools: string[];
  expertise: string[];
  topChannels: Array<{ name: string; purpose: string | null }>;
  displayName: string;
};

export async function extractSkillsForPerson(
  input: PersonSkillInput,
  apiKey?: string,
): Promise<ExtractedSkill[]> {
  if (!input.role || input.role.toLowerCase() === "bot") return [];

  const userMsg =
    `Person: ${input.displayName}\n` +
    `Role: ${input.role}\n` +
    `Summary: ${input.summary ?? "(none)"}\n` +
    `Tools they use: ${input.tools.join(", ") || "(none observed)"}\n` +
    `Expertise areas: ${input.expertise.join(", ") || "(none observed)"}\n` +
    `Top channels:\n` +
    input.topChannels
      .slice(0, 4)
      .map((c) => `  - #${c.name}${c.purpose ? `: ${c.purpose}` : ""}`)
      .join("\n");

  const text = await llmCall({
    system: PERSON_SKILLS_SYSTEM,
    userMessage: userMsg,
    maxTokens: 2048,
    model: "extract",
    apiKey,
  });

  try {
    const parsed = parseJsonBlock<
      Array<{
        type?: ExtractedSkill["type"];
        domain?: string;
        slug?: string;
        title?: string;
        trigger?: string;
        steps_md?: string;
        decision_criteria?: string | null;
        escalation?: string | null;
      }>
    >(text);
    const out: ExtractedSkill[] = [];
    for (const p of parsed) {
      if (!p.type || !p.slug || !p.title || !p.trigger || !p.steps_md) continue;
      out.push({
        type: p.type,
        domain: p.domain || "other",
        slug: p.slug,
        title: p.title,
        trigger: p.trigger,
        steps_md: p.steps_md,
        decision_criteria: p.decision_criteria ?? null,
        escalation: p.escalation ?? null,
        citations: [], // people-derived skills have no thread citations yet
      });
    }
    return out;
  } catch {
    return [];
  }
}
