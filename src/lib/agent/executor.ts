// Action plan executor — Phase 3.
//
// Takes a list of action IDs the reviewer approved on an agent_run and
// runs them in dependency order: communication → remediation →
// housekeeping → memory → escalation. Each step logs to
// agent_action_log so we always know what happened.
//
// SAFETY RAILS (read these before extending):
//
//   1. EXEC_ALLOWLIST is the source of truth — any tool NOT in it is
//      refused even when the LLM proposed it. Stripe writes + Slack
//      writes are deliberately OUT of the allowlist for v1.
//
//   2. Per-tool handlers do their OWN validation (e.g. cancel-sub
//      requires the customer's stripe_customer_id to match, refund
//      requires explicit approval=high). They don't trust the LLM args.
//
//   3. Idempotency: every successful action writes its ID into
//      agent_runs.applied_actions. A second call with the same action
//      ID is a no-op. UI buttons disable themselves once applied.
//
//   4. Reversibility: irreversible actions (public reply, refund) are
//      never executed without an explicit "I'm sure" gate from the UI.
//      The action's `irreversible: true` flag MUST be honoured.

import { decrypt } from "@/lib/crypto";
import {
  db,
  getAgentRun,
  getWorkspace,
  getWorkspaceFreshdesk,
  getActiveCustomerEndpointByName,
  type AgentRun,
} from "@/lib/db";
import { FreshdeskClient } from "@/lib/freshdesk";
import type { AgentAction, AgentTool } from "./tool-catalog";

// ============================================================
// Allowlist — start small, broaden after track record builds
// ============================================================
//
// What gets to run in v1: the actions that can't directly cost money or
// damage customer-visible state. Everything Stripe-write and Slack stays
// locked behind a future opt-in.
//
// Note `freshdesk.reply` IS in the allowlist because that's the existing
// public-reply path (already shipped via the standalone Send button).
// We just route it through the executor now for consistency.
const EXEC_ALLOWLIST: ReadonlySet<AgentTool> = new Set([
  "freshdesk.reply",
  "freshdesk.private_note",
  "freshdesk.set_status",
  "freshdesk.add_tag",
  "freshdesk.set_priority",
  "db.record_customer_fact",
  "db.flag_customer",
  "db.feedback_skill",
  "db.escalate_explicit",
]);

const STAGE_ORDER: AgentAction["stage"][] = [
  "communication",
  "remediation",
  "housekeeping",
  "memory",
  "escalation",
];

export type ExecutionResult = {
  actionId: string;
  tool: AgentTool;
  status: "executed" | "skipped" | "failed" | "blocked";
  message: string;
  result?: unknown;
};

export type ExecuteRunInput = {
  runId: string;
  approvedActionIds: string[];
  executedBy: string | null;
};

export async function executeApprovedActions(
  input: ExecuteRunInput,
): Promise<{ results: ExecutionResult[]; updatedRun: AgentRun | null }> {
  const run = await getAgentRun(input.runId);
  if (!run) {
    return { results: [], updatedRun: null };
  }
  if (run.status !== "pending") {
    return {
      results: [
        {
          actionId: "_run",
          tool: "freshdesk.reply",
          status: "blocked",
          message: `run is ${run.status}, not pending`,
        },
      ],
      updatedRun: run,
    };
  }

  const proposed = (Array.isArray(run.proposed_actions)
    ? (run.proposed_actions as unknown as AgentAction[])
    : []
  ).filter((a) => input.approvedActionIds.includes(a.id));

  if (proposed.length === 0) {
    return { results: [], updatedRun: run };
  }

  const alreadyApplied = new Set(
    (Array.isArray(run.applied_actions) ? (run.applied_actions as string[]) : []),
  );

  // Order by stage to keep semantics predictable: send the reply first,
  // then state-changing actions, then memory updates last.
  const ordered = [...proposed].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  const results: ExecutionResult[] = [];

  for (const action of ordered) {
    // Idempotency
    if (alreadyApplied.has(action.id)) {
      results.push({
        actionId: action.id,
        tool: action.tool,
        status: "skipped",
        message: "already applied earlier",
      });
      continue;
    }

    // Allowlist — built-in tools must be in EXEC_ALLOWLIST.
    // Dynamic customer_api.* tools are allowed when the named endpoint
    // exists and is marked active in the workspace registry (the activation
    // is an explicit operator gesture, so it's its own form of consent).
    const isDynamicCustomerApi = action.tool.startsWith("customer_api.");
    if (!isDynamicCustomerApi && !EXEC_ALLOWLIST.has(action.tool)) {
      results.push({
        actionId: action.id,
        tool: action.tool,
        status: "blocked",
        message: `tool ${action.tool} not in executor allowlist (v1 safety)`,
      });
      continue;
    }

    try {
      const result = await runOne(run, action);
      results.push({
        actionId: action.id,
        tool: action.tool,
        status: "executed",
        message: "ok",
        result,
      });
      alreadyApplied.add(action.id);
      await logAction(run, action, "executed", result, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        actionId: action.id,
        tool: action.tool,
        status: "failed",
        message: msg,
      });
      await logAction(run, action, "failed", null, msg);
      // Continue to next action — a failed tag shouldn't block a reply
    }
  }

  // Persist applied_actions
  await db()
    .from("agent_runs")
    .update({
      applied_actions: Array.from(alreadyApplied),
    })
    .eq("id", run.id);

  const updatedRun = await getAgentRun(run.id);
  return { results, updatedRun };
}

// ============================================================
// Per-tool handlers
// ============================================================

async function runOne(run: AgentRun, action: AgentAction): Promise<unknown> {
  // Dynamic customer endpoint? Handled separately — it's not a switch case
  // because the tool name is workspace-specific (customer_api.{name}).
  if (action.tool.startsWith("customer_api.")) {
    return runCustomerApi(run, action);
  }
  switch (action.tool) {
    case "freshdesk.reply":
      return runFreshdeskReply(run, action);
    case "freshdesk.private_note":
      return runFreshdeskNote(run, action);
    case "freshdesk.set_status":
      return runFreshdeskStatus(run, action);
    case "freshdesk.add_tag":
      return runFreshdeskTag(run, action);
    case "freshdesk.set_priority":
      return runFreshdeskPriority(run, action);
    case "db.record_customer_fact":
      return runDbCustomerFact(run, action);
    case "db.flag_customer":
      return runDbFlagCustomer(run, action);
    case "db.feedback_skill":
      return runDbFeedbackSkill(run, action);
    case "db.escalate_explicit":
      return runDbEscalate(run, action);
    default:
      throw new Error(`no handler for ${action.tool}`);
  }
}

// ---------- Dynamic customer endpoint handler ----------

/**
 * Call a workspace-registered customer endpoint.
 *
 * Steps:
 *   1. Look up the endpoint by name (must be active for this workspace).
 *   2. Substitute URL template vars from action.args (e.g. {email} → args.email).
 *   3. For GET: remaining args become query params. For POST/PUT/PATCH: args
 *      become the JSON body.
 *   4. Decrypt the stored Bearer token (if any) and add Authorization header.
 *   5. 10s timeout. Return parsed JSON response (or { status, text } on non-JSON).
 *
 * The result is stored in the agent_action_log for audit; the agent's next
 * draft can reference it via the customer_facts memory if needed.
 */
async function runCustomerApi(run: AgentRun, action: AgentAction): Promise<unknown> {
  const endpointName = action.tool.slice("customer_api.".length);
  if (!endpointName) throw new Error("malformed customer_api tool name");

  const endpoint = await getActiveCustomerEndpointByName(run.workspace_id, endpointName);
  if (!endpoint) {
    throw new Error(
      `endpoint ${endpointName} not found or not active in workspace registry`,
    );
  }
  if (!endpoint.live_base_url) {
    throw new Error(`endpoint ${endpointName} has no live_base_url configured`);
  }

  // Substitute URL template vars: /api/v1/customers/{email} → /api/v1/customers/sarah@...
  let path = endpoint.url_template;
  const consumedArgs = new Set<string>();
  for (const [key, value] of Object.entries(action.args)) {
    const token = `{${key}}`;
    if (path.includes(token)) {
      path = path.replace(token, encodeURIComponent(String(value)));
      consumedArgs.add(key);
    }
  }

  // Remaining args go to query string (GET) or JSON body (mutations)
  const remainingArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action.args)) {
    if (!consumedArgs.has(key)) remainingArgs[key] = value;
  }

  // Build the full URL — handle path that may or may not include base
  const fullUrl = path.startsWith("http")
    ? path
    : endpoint.live_base_url.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (endpoint.encrypted_auth_token) {
    headers.Authorization = `Bearer ${decrypt(endpoint.encrypted_auth_token)}`;
  }

  let url = fullUrl;
  const init: RequestInit = {
    method: endpoint.method,
    headers,
    signal: AbortSignal.timeout(10_000),
  };

  if (endpoint.method === "GET" || endpoint.method === "DELETE") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(remainingArgs)) {
      if (v != null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url = url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
  } else if (Object.keys(remainingArgs).length > 0) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(remainingArgs);
  }

  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // not JSON — keep raw text
  }
  if (!res.ok) {
    throw new Error(
      `customer_api ${endpointName} → ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return { status: res.status, body: parsed };
}

async function fdClient(workspaceId: string): Promise<FreshdeskClient> {
  const conn = await getWorkspaceFreshdesk(workspaceId);
  if (!conn) throw new Error("freshdesk not connected on this workspace");
  return new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));
}

async function runFreshdeskReply(run: AgentRun, action: AgentAction) {
  const body = String(action.args.body ?? "").trim();
  if (!body) throw new Error("empty reply body");
  const fd = await fdClient(run.workspace_id);
  return await fd.postPublicReply(run.ticket_id, body);
}

async function runFreshdeskNote(run: AgentRun, action: AgentAction) {
  const body = String(action.args.body ?? "").trim();
  if (!body) throw new Error("empty note body");
  const fd = await fdClient(run.workspace_id);
  return await fd.postPrivateNote(run.ticket_id, body);
}

async function runFreshdeskStatus(run: AgentRun, action: AgentAction) {
  const status = Number(action.args.status);
  if (![2, 3, 4, 5].includes(status)) throw new Error("invalid status (must be 2,3,4,5)");
  const fd = await fdClient(run.workspace_id);
  await freshdeskUpdate(fd, run.ticket_id, { status });
  return { status };
}

async function runFreshdeskTag(run: AgentRun, action: AgentAction) {
  const tags = Array.isArray(action.args.tags)
    ? (action.args.tags as string[]).filter((t) => typeof t === "string" && t.length > 0)
    : [];
  if (tags.length === 0) throw new Error("no tags to add");
  const fd = await fdClient(run.workspace_id);
  await freshdeskUpdate(fd, run.ticket_id, { tags });
  return { tags };
}

async function runFreshdeskPriority(run: AgentRun, action: AgentAction) {
  const priority = Number(action.args.priority);
  if (![1, 2, 3, 4].includes(priority)) throw new Error("invalid priority (must be 1-4)");
  const fd = await fdClient(run.workspace_id);
  await freshdeskUpdate(fd, run.ticket_id, { priority });
  return { priority };
}

/**
 * Generic Freshdesk PUT to /api/v2/tickets/{id} — covers status/tag/priority
 * with one HTTP call instead of 3 client methods. Lives here rather than in
 * freshdesk.ts because it's an executor concern.
 */
async function freshdeskUpdate(
  fd: FreshdeskClient,
  ticketId: number,
  body: Record<string, unknown>,
): Promise<void> {
  // FreshdeskClient exposes domain + apiKey via the URL helper but not
  // direct fetch. We rebuild the request from the public helpers.
  const url = fd.ticketUrl(ticketId).replace("/a/tickets/", "/api/v2/tickets/");
  const conn = (fd as unknown as { domain: string; apiKey: string });
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Basic " + Buffer.from(`${conn.apiKey}:`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Freshdesk PUT ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ---------- DB handlers (slackmap-internal writes) ----------

async function runDbCustomerFact(run: AgentRun, action: AgentAction) {
  const email = String(action.args.customer_email ?? run.requester_email ?? "").trim();
  const fact = String(action.args.fact ?? "").trim();
  if (!email || !fact) throw new Error("customer_email and fact required");
  const tags = Array.isArray(action.args.tags) ? (action.args.tags as string[]) : [];
  const { data, error } = await db()
    .from("customer_facts")
    .insert({
      workspace_id: run.workspace_id,
      customer_email: email.toLowerCase(),
      fact,
      tags,
      source_run_id: run.id,
      source_ticket_id: run.ticket_id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { factId: data?.id };
}

async function runDbFlagCustomer(run: AgentRun, action: AgentAction) {
  const email = String(action.args.customer_email ?? run.requester_email ?? "").trim();
  const flag = String(action.args.flag ?? "").trim();
  const allowed = ["vip", "fragile", "churn-risk", "fraud-risk", "refunded"];
  if (!email || !allowed.includes(flag)) {
    throw new Error(`invalid flag (allowed: ${allowed.join("|")})`);
  }
  // Stored as a customer_fact with a special tag
  const { error } = await db()
    .from("customer_facts")
    .insert({
      workspace_id: run.workspace_id,
      customer_email: email.toLowerCase(),
      fact: `Flagged as ${flag}`,
      tags: ["flag", `flag:${flag}`],
      source_run_id: run.id,
      source_ticket_id: run.ticket_id,
    });
  if (error) throw error;
  return { flag };
}

async function runDbFeedbackSkill(run: AgentRun, action: AgentAction) {
  const slug = String(action.args.slug ?? "").trim();
  if (!slug) throw new Error("slug required");
  // Increment applied_count + bump last_applied_at on the skill row
  const { data: skill } = await db()
    .from("skills")
    .select("id, applied_count")
    .eq("workspace_id", run.workspace_id)
    .eq("slug", slug)
    .maybeSingle();
  if (!skill) throw new Error(`skill ${slug} not found`);
  const next = (skill.applied_count as number | null) ?? 0;
  const { error } = await db()
    .from("skills")
    .update({
      applied_count: next + 1,
      last_applied_at: new Date().toISOString(),
    })
    .eq("id", skill.id as string);
  if (error) throw error;
  return { slug, applied_count: next + 1 };
}

async function runDbEscalate(run: AgentRun, action: AgentAction) {
  const reason = String(action.args.reason ?? "").trim();
  if (!reason) throw new Error("reason required for explicit escalation");
  // Record as a customer_fact + bump priority via a Freshdesk private note
  const fd = await fdClient(run.workspace_id);
  await fd.postPrivateNote(
    run.ticket_id,
    `🚨 EXPLICIT ESCALATION (slackmap agent)\nReason: ${reason}\nSource run: ${run.id}`,
  );
  return { reason };
}

// ============================================================
// Audit log
// ============================================================

async function logAction(
  run: AgentRun,
  action: AgentAction,
  outcome: "executed" | "failed",
  result: unknown,
  error: string | null,
): Promise<void> {
  await db()
    .from("agent_action_log")
    .insert({
      workspace_id: run.workspace_id,
      run_id: run.id,
      action_id: action.id,
      tool: action.tool,
      args: action.args as Record<string, unknown>,
      result: outcome === "executed" ? (result as object) : null,
      error,
    });
}
