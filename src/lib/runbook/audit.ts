// Runbook Audit — the killer demo flow.
//
// Customer pastes ONE thing (an API URL + bearer token, a DB connection
// string, or an admin web URL). The agent:
//   1. Auto-detects the kind from the URL pattern
//   2. Probes the endpoint cheaply (HEAD + a few common GET paths for API,
//      schema query for DB, presence check for admin)
//   3. Pulls the workspace's last ~90 days of Freshdesk tickets +
//      extracted skills
//   4. Asks the LLM to cross-reference: "what 5-10 endpoints should the
//      customer's dev team build to automate the support queue?"
//   5. Returns a ranked structured report
//
// Result is persisted in audit_runs + the proposed endpoints land in
// customer_endpoints with status='proposed'. Once a customer marks an
// endpoint as 'implemented' and then 'active', the agent's tool catalog
// picks it up dynamically and starts using it in action plans.

import { llmCall, parseJsonBlock } from "@/lib/extract/anthropic";
import { listSkills } from "@/lib/db";
import type { Workspace } from "@/lib/db";

export type DataSourceKind = "api" | "database" | "admin";

export type RawDataSourceInput = {
  /** Free-text the user pasted — URL + maybe a token. Agent auto-detects. */
  raw: string;
  /** Optional label the user provides. */
  label?: string;
};

export type DetectedSource = {
  kind: DataSourceKind;
  base_url: string;
  credential: string | null;
  /** Confidence 0-100 in the auto-detection. */
  confidence: number;
  reasoning: string;
};

/**
 * Light pattern detection. We don't want to be clever here — most
 * customers will paste an API URL with a Bearer token. The few edge
 * cases get a 50% confidence and let the user confirm in UI.
 */
export function detectSource(input: RawDataSourceInput): DetectedSource {
  const raw = input.raw.trim();
  // Try to split URL + token on whitespace / newline / comma
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const urlPart = parts.find((p) => /^https?:\/\//i.test(p)) ?? parts[0];
  const tokenPart = parts.find((p) => p !== urlPart && p.length >= 20);

  const lower = urlPart?.toLowerCase() ?? "";

  // Database connection string (postgres://, mysql://, mongodb://)
  if (/^(postgres|postgresql|mysql|mongodb|redis):\/\//.test(lower)) {
    return {
      kind: "database",
      base_url: urlPart,
      credential: null, // embedded in the URL
      confidence: 95,
      reasoning: "Recognised a DB-style connection scheme.",
    };
  }

  // Admin URL — typically /admin or admin. subdomain
  if (/\badmin\b|\/admin/.test(lower)) {
    return {
      kind: "admin",
      base_url: urlPart,
      credential: tokenPart ?? null,
      confidence: 70,
      reasoning: "URL contains 'admin' — assuming web admin login.",
    };
  }

  // Default — API base URL
  return {
    kind: "api",
    base_url: urlPart,
    credential: tokenPart ?? null,
    confidence: 80,
    reasoning: "Looks like an HTTPS API base URL.",
  };
}

/**
 * Probe an API base URL. Returns whatever we discover lightweight-
 * structurally: a few common paths, content type of root, the OPTIONS
 * response. We deliberately do NOT crawl — just enough to tell the LLM
 * "this API exists and responded with X". Bearer token optional.
 */
export async function probeApi(
  baseUrl: string,
  token: string | null,
): Promise<{ ok: boolean; probes: Array<{ path: string; status: number | string; sample?: string }> }> {
  const probes: Array<{ path: string; status: number | string; sample?: string }> = [];
  const commonPaths = [
    "/",
    "/api",
    "/api/v1",
    "/api/v2",
    "/v1",
    "/health",
    "/openapi.json",
    "/swagger.json",
    "/.well-known/openid-configuration",
  ];

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  for (const path of commonPaths) {
    try {
      const url = baseUrl.replace(/\/$/, "") + path;
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(4_000),
      });
      let sample: string | undefined;
      if (res.ok) {
        const text = await res.text().catch(() => "");
        sample = text.slice(0, 600);
      }
      probes.push({ path, status: res.status, sample });
    } catch (e) {
      probes.push({ path, status: (e as Error).message?.slice(0, 80) ?? "error" });
    }
  }
  return { ok: probes.some((p) => p.status === 200), probes };
}

// ============================================================
// Audit Report schema — what the LLM produces
// ============================================================

export type ProposedEndpoint = {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url_template: string;
  description: string;
  why: string;
  request_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  auth_hint: string;
  estimated_ticket_coverage: number;
  estimated_ticket_coverage_pct: number;
  code_sample: string;
};

export type AuditReport = {
  /** Total tickets considered. */
  tickets_analyzed_count: number;
  /** % of tickets the agent already covers WITHOUT any new endpoint. */
  coverage_current_pct: number;
  /** % the agent WOULD cover if all proposed endpoints existed. */
  coverage_target_pct: number;
  /** 1-2 sentence executive summary. */
  executive_summary: string;
  /** Detected stack of the customer (best guess). */
  detected_stack: string;
  /** Ranked endpoints. */
  proposed_endpoints: ProposedEndpoint[];
  /** Endpoints we already cover (Stripe, etc.) — for credit. */
  already_covered: string[];
  /** Gaps where data isn't available anywhere — needs Marc / dev manual. */
  unresolvable_gaps: string[];
  next_step: string;
};

const AUDIT_SYSTEM = `You are a senior product engineer auditing a company's data layer to recommend exactly which API endpoints their dev team should expose so that an AI customer-support agent can automate their support queue.

You receive:
  - A summary of the customer's data source (auto-detected: API / DB / admin)
  - Light probe results (which paths responded, what shapes were returned)
  - The last ~90 days of Freshdesk tickets, with categories / topics / urgency
  - The catalog of skills already extracted from those tickets

Your job — output ONE JSON object matching this schema:

{
  "tickets_analyzed_count": <int>,
  "coverage_current_pct": <0-100>,
  "coverage_target_pct": <0-100>,
  "executive_summary": "<1-2 sentences — what's the big win>",
  "detected_stack": "<one line — 'Bun + Drizzle (MySQL + Postgres), Astro admin, SST/AWS deploys' if detectable>",
  "proposed_endpoints": [
    {
      "name": "<snake_case_name>",
      "method": "GET" | "POST" | ...,
      "url_template": "/api/v1/customers/{email}/subscription",
      "description": "<1 sentence — what it returns>",
      "why": "<grounded in tickets: 'X tickets in last 90d asked about Y, currently Marc looks this up manually in Z'>",
      "request_schema": { "email": "string (URL param)" },
      "response_schema": { "plan": "string", "trial_end_at": "ISO date", ... },
      "auth_hint": "Bearer JWT (admin scope) — Marc-level read access",
      "estimated_ticket_coverage": <int — how many tickets this unlocks>,
      "estimated_ticket_coverage_pct": <0-100>,
      "code_sample": "// Bun route handler in targets/api/src/routes/admin/customers.ts\\nexport const subscriptionRoute = ...\\n// (8-15 lines of realistic-looking code in the customer's stack)"
    },
    ... (5-10 endpoints, ranked by estimated_ticket_coverage descending)
  ],
  "already_covered": ["e.g. Stripe subscriptions — handled via the existing Stripe integration"],
  "unresolvable_gaps": ["e.g. 'Bug status from Sentry — needs a separate Sentry connector'"],
  "next_step": "<one line — what should the user do next>"
}

RULES:
- Be SPECIFIC. Don't say "an endpoint for users" — say "GET /api/v1/customers/{email}/subscription returning {plan, trial_end_at, cancel_at_period_end, dunning_state}".
- Ground EVERY endpoint in a real ticket pattern. Quote a count and a topic.
- Code samples MUST match the customer's detected stack. If it's Bun + Drizzle, give Bun handler code. If it's Express, Express. If unknown, give framework-agnostic pseudocode.
- Rank by estimated_ticket_coverage descending.
- TOTAL coverage uplift = sum of estimated_ticket_coverage_pct across proposed endpoints — should be 50-80% range. If lower, say so honestly.
- Don't propose endpoints for data that doesn't exist in the customer's domain. Read the tickets carefully.
- The executive_summary leads with the punchline ("Build these 7 endpoints to automate 71% of your queue").
- next_step is concrete: "Have your team implement these 3 endpoints first (rank #1-3), then mark them as 'implemented' in the audit page so the agent starts using them."`;

export type RunAuditInput = {
  workspace: Workspace;
  detected: DetectedSource;
  probe?: Awaited<ReturnType<typeof probeApi>>;
  freshdeskTicketsSummary: string;
  apiKey?: string;
};

export async function runAudit(input: RunAuditInput): Promise<AuditReport> {
  const skills = await listSkills(input.workspace.id);
  const skillsBlock = skills.length === 0
    ? "(no skills extracted yet)"
    : skills
        .slice(0, 30)
        .map(
          (s, i) =>
            `${i + 1}. ${s.slug} (${s.domain ?? "other"}) — ${s.title}${
              s.trigger ? ` · trigger: ${s.trigger.slice(0, 80)}` : ""
            }`,
        )
        .join("\n");

  const probeBlock = input.probe
    ? `## API probe results\n${input.probe.probes
        .map(
          (p) =>
            `  ${p.path} → ${p.status}${p.sample ? `\n    sample: ${p.sample.slice(0, 200).replace(/\s+/g, " ")}` : ""}`,
        )
        .join("\n")}\n  reachable: ${input.probe.ok}`
    : "(no probe — likely a database or admin source)";

  const userMessage = [
    `## Data source detected`,
    `kind: ${input.detected.kind}`,
    `base_url: ${input.detected.base_url}`,
    `confidence: ${input.detected.confidence}%`,
    `detection_reasoning: ${input.detected.reasoning}`,
    ``,
    probeBlock,
    ``,
    `## Workspace context`,
    `company: ${input.workspace.slack_team_name}`,
    `industry: ${
      (input.workspace as { company_industry?: string | null }).company_industry ?? "unknown"
    }`,
    `tools they use: ${
      Array.isArray((input.workspace as { company_tools?: string[] | null }).company_tools)
        ? ((input.workspace as { company_tools?: string[] | null }).company_tools ?? []).join(", ")
        : "unknown"
    }`,
    ``,
    `## Freshdesk ticket patterns (last 90 days)`,
    input.freshdeskTicketsSummary,
    ``,
    `## Skills already extracted (${skills.length})`,
    skillsBlock,
    ``,
    `Produce the audit report JSON now.`,
  ].join("\n");

  const text = await llmCall({
    system: AUDIT_SYSTEM,
    userMessage,
    maxTokens: 5500,
    model: "extract",
    apiKey: input.apiKey,
  });

  return parseJsonBlock<AuditReport>(text);
}
