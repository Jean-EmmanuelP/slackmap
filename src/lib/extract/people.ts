import { llmCall, parseJsonBlock } from "./anthropic";
import { buildCompanyContextBlock, type CompanyContextWorkspace } from "./company-context-block";

export type PersonExtractionInput = {
  display_name: string | null;
  real_name: string | null;
  title: string | null;
  topChannels: Array<{ name: string; purpose: string | null; count: number }>;
  sampleMessages: string[]; // up to ~30 of their messages
  totalMessages: number;
  /** Optional human-provided context. Use to correct an earlier mistake or
   *  provide info not visible from Slack alone (e.g. "She's the founder", "He
   *  is a contractor working on payments only"). Treated as ground truth. */
  hint?: string | null;
};

export type PersonExtractionOutput = {
  role: string | null;
  summary: string | null;
  tools: string[];
  expertise: string[];
};

const SYSTEM = `You analyze Slack activity of ONE person to produce a concise AI profile
("fiche IA") of what they actually do at the company.

Output ONLY JSON:
{
  "role": "Backend Engineer" | "Customer Success Lead" | etc.  // 2-4 words, behavior-inferred
  "summary": "1 sentence naming WHAT THEY SPECIFICALLY OWN, in present tense",
  "tools": ["VS Code", "Linear"],                              // see frequency rule below
  "expertise": ["Postgres", "iOS billing"]                     // domain areas they discuss with depth
}

Rules:
- Be FAITHFUL to evidence in the messages. Don't invent skills.
- Role should be inferred from BEHAVIOR (what they discuss / do), not from their Slack title.
  But if title is informative, use it as a hint.
- Avoid generic role labels like "Team Member", "Contributor", "Generalist" when the
  evidence is enough to commit to a sharper title (e.g. "Backend Engineer", "Customer
  Success Lead", "Product Designer"). Only fall back to a generic label when truly
  ambiguous after considering tools, expertise, and channels.
- Tools = concrete software/platforms / SaaS the person is observed working
  WITH (Notion, Stripe, Figma, Linear, GitHub, Zendesk, Freshdesk, OVH,
  TestFlight, App Store, Webflow, Shopify, Google Drive, Stripe Dashboard,
  PagerDuty, Datadog, Customer.io, etc.).
  Include a tool if EITHER: (a) it's named ≥1× and the surrounding message
  shows them doing operational work with it ("je viens de pousser sur OVH",
  "j'ai update la promo dans Stripe Dashboard", "TestFlight build cassé") —
  count this as evidence; OR (b) it's named ≥2× across messages.
  Infer responsibly: if someone discusses "le pricing dans le store" they
  likely use the App Store / Play Store dashboards; if they ship code daily
  they likely use GitHub. Use the channel context as a tiebreaker.
  Skip ultra-generic tools like "Slack", "Gmail", "Excel" unless notably central.
- Expertise = topical domains they engage in with depth (not surface-level mentions).
- summary names WHAT THEY SPECIFICALLY OWN — not "contributes to the team" or
  "active in many channels". Examples:
    Good: "Owns the Stripe billing integration and refund decisions under $500."
    Good: "Leads iOS release process and App Store review responses."
    Bad: "Contributes to product discussions across the team."
- If insufficient data, set role:null and keep summary brief and honest.
- If the person is clearly a bot or automated account, set role: "Bot".`;

export async function extractPerson(
  input: PersonExtractionInput,
  apiKey?: string,
  companyContext?: CompanyContextWorkspace | null,
): Promise<PersonExtractionOutput> {
  const channelsBlock = input.topChannels
    .slice(0, 5)
    .map((c) => `  - #${c.name} (${c.count} msgs)${c.purpose ? `: ${c.purpose}` : ""}`)
    .join("\n");

  const messagesBlock = input.sampleMessages
    .slice(0, 40)
    .map((m, i) => `  ${i + 1}. ${m.replace(/\s+/g, " ").slice(0, 240)}`)
    .join("\n");

  const userMsg =
    `Person:\n` +
    `  display_name: ${input.display_name ?? "(none)"}\n` +
    `  real_name: ${input.real_name ?? "(none)"}\n` +
    `  slack_title: ${input.title ?? "(none)"}\n` +
    `  total_messages_observed: ${input.totalMessages}\n\n` +
    `Top channels:\n${channelsBlock}\n\n` +
    `Sample of their messages:\n${messagesBlock}`;

  const systemWithHint = input.hint
    ? `${SYSTEM}\n\nIMPORTANT — human-provided context about this person (treat as ground truth, override your inference if it conflicts):\n${input.hint}`
    : SYSTEM;

  const systemWithCompany = buildCompanyContextBlock(companyContext) + systemWithHint;

  const text = await llmCall({
    system: systemWithCompany,
    userMessage: userMsg,
    maxTokens: 800,
    model: "extract",
    apiKey,
  });

  try {
    const parsed = parseJsonBlock<{
      role?: string;
      summary?: string;
      tools?: string[];
      expertise?: string[];
    }>(text);
    return {
      role: parsed.role || null,
      summary: parsed.summary || null,
      tools: Array.isArray(parsed.tools) ? parsed.tools.slice(0, 12) : [],
      expertise: Array.isArray(parsed.expertise) ? parsed.expertise.slice(0, 8) : [],
    };
  } catch {
    return { role: null, summary: null, tools: [], expertise: [] };
  }
}
