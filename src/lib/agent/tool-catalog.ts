// The catalog of tools the LLM can propose in an Action Plan.
//
// IMPORTANT: this file declares the INTERFACE (tool names, args, reasoning
// requirements, irreversibility flags). It does NOT execute anything. The
// executor lives in src/lib/agent/executor.ts and is gated behind a feature
// flag; for now we're in Phase 1+2 (LLM proposes plans, UI displays them
// read-only, nothing fires).
//
// When adding a tool: append to TOOL_CATALOG, update the AgentTool union,
// and (later) implement the handler in the executor. The LLM sees this
// catalog as part of its system prompt so it knows what's available.

export type ApprovalLevel = "low" | "medium" | "high";

export type ActionStage =
  | "communication" // direct customer-facing message
  | "remediation"   // changes the customer's account / state externally
  | "housekeeping"  // ticket lifecycle, internal status
  | "memory"        // slackmap-internal facts / feedback
  | "escalation";   // explicit handoff signal

export type AgentTool =
  // Freshdesk pillar
  | "freshdesk.reply"
  | "freshdesk.private_note"
  | "freshdesk.set_status"
  | "freshdesk.add_tag"
  | "freshdesk.set_priority"
  // Stripe pillar
  | "stripe.process_refund"
  | "stripe.cancel_subscription"
  | "stripe.retry_invoice"
  | "stripe.add_customer_note"
  // Slack pillar (dev-team awareness loop). The agent READS from nominated
  // context channels in Phase 1; here it can also PROPOSE writes back into
  // those channels so devs are notified of incoming tickets. Execution is
  // deliberately disabled — the user explicitly said "ne le fais pas encore
  // maintenant" because customer service would push back on visible Slack
  // posts from the bot. The proposals show up in the plan but the executor
  // refuses to run them until phase 3 enables it.
  | "slack.notify_bug_channel"
  // DB pillar (slackmap-internal)
  | "db.record_customer_fact"
  | "db.flag_customer"
  | "db.feedback_skill"
  | "db.escalate_explicit";

export type ToolSpec = {
  tool: AgentTool;
  pillar: "freshdesk" | "stripe" | "slack" | "db";
  stage: ActionStage;
  /** True = cannot be undone once executed (refund, public reply already sent).
   * UI marks these with a stronger warning. */
  irreversible: boolean;
  /** Suggested approval level. The LLM may override based on context, but
   * Stripe writes default to "high" because they hit the customer's wallet. */
  default_approval: ApprovalLevel;
  /** Free-text description for the prompt. Tells the LLM when to use this
   * tool and what the args mean. */
  description: string;
  /** JSON-schema-like description of args. Loose on purpose — the LLM
   * fills in best-effort and the executor validates strictly. */
  args_schema: Record<string, string>;
  /** When true, the executor refuses to run this tool regardless of approval.
   * Used to keep certain proposals visible (so reviewers see what the agent
   * thinks SHOULD happen) without ever executing them. Today Slack writes
   * are all locked off per explicit user request. */
  exec_locked?: boolean;
};

export const TOOL_CATALOG: ToolSpec[] = [
  // ---------- Freshdesk ------------------------------------------------
  {
    tool: "freshdesk.reply",
    pillar: "freshdesk",
    stage: "communication",
    irreversible: true,
    default_approval: "medium",
    description:
      "Send a public reply to the customer on the ticket. This is what the customer sees in their inbox. Always include this when the ticket needs a response — even if you also propose remediation actions.",
    args_schema: {
      body: "string — the full reply text in the customer's language",
    },
  },
  {
    tool: "freshdesk.private_note",
    pillar: "freshdesk",
    stage: "communication",
    irreversible: true,
    default_approval: "low",
    description:
      "Add a private internal note (only agents see it). Use to leave context for the next human agent, flag suspicious patterns, or document why you proposed remediation.",
    args_schema: {
      body: "string — the note text",
    },
  },
  {
    tool: "freshdesk.set_status",
    pillar: "freshdesk",
    stage: "housekeeping",
    irreversible: false,
    default_approval: "low",
    description:
      "Change the ticket status. 2=open, 3=pending (waiting on customer), 4=resolved, 5=closed. Use 'resolved' when the issue is fully addressed AND the reply has been sent. Use 'pending' when you're waiting on the customer for info.",
    args_schema: {
      status: "number (2|3|4|5)",
    },
  },
  {
    tool: "freshdesk.add_tag",
    pillar: "freshdesk",
    stage: "housekeeping",
    irreversible: false,
    default_approval: "low",
    description:
      "Add a tag to the ticket for tracking. Useful tags: 'refund-given', 'cancel-at-period-end', 'ios-bug', 'spam', 'vip', 'gdpr', 'escalated-eng'.",
    args_schema: {
      tags: "string[] — one or more tags to add",
    },
  },
  {
    tool: "freshdesk.set_priority",
    pillar: "freshdesk",
    stage: "housekeeping",
    irreversible: false,
    default_approval: "low",
    description:
      "Set ticket priority. 1=low, 2=medium, 3=high, 4=urgent. Bump to high/urgent for VIP customers, multi-customer impact, or revenue-blocking issues.",
    args_schema: {
      priority: "number (1|2|3|4)",
    },
  },
  // ---------- Stripe ---------------------------------------------------
  {
    tool: "stripe.process_refund",
    pillar: "stripe",
    stage: "remediation",
    irreversible: true,
    default_approval: "high",
    description:
      "Refund a Stripe charge. amount_cents optional — omit for full refund. ONLY propose this when (a) a skill explicitly authorizes the refund OR (b) the customer is clearly within a refund-eligible window per company policy. The reviewer always has final say — never assume approval.",
    args_schema: {
      charge_id: "string — Stripe charge ID (ch_...)",
      amount_cents: "number? — partial amount in cents, omit for full refund",
      reason: "string — short reason logged with Stripe (e.g. 'requested_by_customer')",
    },
  },
  {
    tool: "stripe.cancel_subscription",
    pillar: "stripe",
    stage: "remediation",
    irreversible: false,
    default_approval: "high",
    description:
      "Cancel a subscription. By default cancels at period end (customer keeps access until the paid period expires) — set immediately=true ONLY when the customer explicitly asks to lose access now. This is reversible BEFORE the period end runs out.",
    args_schema: {
      subscription_id: "string — Stripe subscription ID (sub_...)",
      immediately: "boolean? — default false (cancel at period end)",
    },
  },
  {
    tool: "stripe.retry_invoice",
    pillar: "stripe",
    stage: "remediation",
    irreversible: false,
    default_approval: "medium",
    description:
      "Re-attempt collection on a failed invoice. Use when the customer says they've updated their card / fixed their bank issue and wants to retry now.",
    args_schema: {
      invoice_id: "string — Stripe invoice ID (in_...)",
    },
  },
  {
    tool: "stripe.add_customer_note",
    pillar: "stripe",
    stage: "memory",
    irreversible: false,
    default_approval: "low",
    description:
      "Append a note to the Stripe customer's metadata. Use for context that Stripe support / billing teams might need later (e.g. 'refunded May 2026 due to trial access bug iOS').",
    args_schema: {
      customer_id: "string — Stripe customer ID (cus_...)",
      note: "string — short note (max 500 chars)",
    },
  },
  // ---------- Slack (dev-team awareness loop) --------------------------
  // EXEC LOCKED: proposed in plans, never executed. Per explicit user
  // direction — customer service team would push back on visible bot posts.
  // Will be unlocked manually once the team is on board.
  {
    tool: "slack.notify_bug_channel",
    pillar: "slack",
    stage: "communication",
    irreversible: true,
    default_approval: "medium",
    exec_locked: true,
    description:
      "Post a structured summary of this ticket into the workspace's nominated bug/support Slack channel (configured via Slack-as-context panel). Used to KEEP DEVS IN THE LOOP about incoming customer reports without forcing them to watch Freshdesk. Propose this for bug / technical / regression tickets where eng context would help, NEVER for billing-only tickets.",
    args_schema: {
      summary: "string — 2-4 line summary including ticket subject, requester, suspected root cause, matched skills",
      severity: "string — 'minor' | 'major' | 'blocker'",
    },
  },
  // ---------- DB (slackmap-internal memory) ----------------------------
  {
    tool: "db.record_customer_fact",
    pillar: "db",
    stage: "memory",
    irreversible: false,
    default_approval: "low",
    description:
      "Record a fact about this customer in slackmap's own DB. Cross-ticket memory — sarah asked about refund 2 weeks ago, today asks again, the agent sees this. Use for: refund history, plan preferences, repeated issues, sensitive context. Keep facts short and atomic.",
    args_schema: {
      customer_email: "string — the customer's email",
      fact: "string — one short atomic fact",
      tags: "string[] — categorical tags for filtering (e.g. ['refund-given', 'ios-bug'])",
    },
  },
  {
    tool: "db.flag_customer",
    pillar: "db",
    stage: "memory",
    irreversible: false,
    default_approval: "low",
    description:
      "Set a categorical flag on the customer. Flags: 'vip' (high-priority handling), 'fragile' (handle with care), 'churn-risk' (likely to cancel), 'fraud-risk' (suspicious activity), 'refunded' (already received a goodwill refund). Reviewer can unflag manually.",
    args_schema: {
      customer_email: "string",
      flag: "string — one of: vip|fragile|churn-risk|fraud-risk|refunded",
    },
  },
  {
    tool: "db.feedback_skill",
    pillar: "db",
    stage: "memory",
    irreversible: false,
    default_approval: "low",
    description:
      "Mark that a specific skill was useful for this ticket. Increments applied_count and updates last_applied_at on the skill row. This is the learning loop — skills used successfully rise in confidence.",
    args_schema: {
      slug: "string — the skill slug that grounded the draft",
    },
  },
  {
    tool: "db.escalate_explicit",
    pillar: "db",
    stage: "escalation",
    irreversible: false,
    default_approval: "low",
    description:
      "Flag this run as 'needs human attention beyond a normal review' — the reviewer is told this is NOT a routine review. Use for: edge cases, suspected fraud, customer threatening legal action, multi-customer impact, anything where Marc should think twice.",
    args_schema: {
      reason: "string — short reason for the explicit escalation",
    },
  },
];

/**
 * Render the catalog as a compact block for the LLM system prompt. Lists
 * each tool with its description + arg schema + default approval level.
 * Kept terse to fit in the prompt without ballooning tokens.
 */
export function renderCatalogForPrompt(): string {
  const lines: string[] = [];
  let currentPillar: string | null = null;
  for (const t of TOOL_CATALOG) {
    if (t.pillar !== currentPillar) {
      currentPillar = t.pillar;
      lines.push(`\n### Pillar: ${t.pillar}`);
    }
    const argsList = Object.entries(t.args_schema)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    lines.push(
      `- ${t.tool} (${t.stage}, approval=${t.default_approval}${t.irreversible ? ", IRREVERSIBLE" : ""}): ${t.description}\n    args: { ${argsList} }`,
    );
  }
  return lines.join("\n");
}

// ---- The shape the LLM must emit ----------------------------------------

export type AgentAction = {
  id: string;
  tool: AgentTool;
  args: Record<string, unknown>;
  reason: string;
  stage: ActionStage;
  irreversible: boolean;
  approval: ApprovalLevel;
};
