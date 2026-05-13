import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export type Workspace = {
  id: string;
  slack_team_id: string;
  slack_team_name: string;
  slack_team_domain: string | null;
  encrypted_bot_token: string;
  encrypted_user_token: string | null;
  installed_by_slack_user_id: string;
  installed_by_slack_user_name: string | null;
  created_at: string;
  updated_at: string;
  backfill_status: "pending" | "running" | "ready" | "failed";
  backfill_progress: number;
  backfill_total: number;
  backfill_error: string | null;
  last_event_received_at: string | null;
  encrypted_anthropic_api_key: string | null;
  anthropic_key_set_at: string | null;
  encrypted_freshdesk_api_key: string | null;
  freshdesk_domain: string | null;
  freshdesk_connected_at: string | null;
  freshdesk_status: "idle" | "queued" | "running" | "done" | "failed";
  freshdesk_error: string | null;
  slack_team_icon_url: string | null;
  encrypted_linkup_api_key: string | null;
  linkup_key_set_at: string | null;
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  company_industry: string | null;
  company_audience: "b2b" | "b2c" | "both" | null;
  company_tools: string[] | null;
  company_scope: "worldwide" | "national" | null;
  company_country: string | null;
  company_context: Record<string, unknown> | null;
  company_resolved_at: string | null;
};

export type Channel = {
  id: string;
  workspace_id: string;
  slack_channel_id: string;
  name: string;
  topic: string | null;
  purpose_native: string | null;
  purpose_extracted: string | null;
  category: string | null;
  message_count_6mo: number;
  unique_contributors: number;
  last_message_at: string | null;
  archived: boolean;
  is_private: boolean;
  mining_enabled: boolean;
  mining_status: "idle" | "queued" | "running" | "done" | "failed";
  mining_last_run_at: string | null;
  mining_error: string | null;
};

export async function getChannel(channelDbId: string): Promise<Channel | null> {
  const { data, error } = await db().from("channels").select("*").eq("id", channelDbId).maybeSingle();
  if (error) throw error;
  return (data as Channel) ?? null;
}

export async function setChannelMining(
  channelDbId: string,
  patch: Partial<Pick<Channel, "mining_enabled" | "mining_status" | "mining_last_run_at" | "mining_error">>,
): Promise<void> {
  const { error } = await db()
    .from("channels")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", channelDbId);
  if (error) throw error;
}

export async function listMinableChannels(workspaceId: string, includePrivate: boolean): Promise<Channel[]> {
  let query = db()
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .or("mining_enabled.eq.false,mining_status.eq.failed");
  if (!includePrivate) query = query.eq("is_private", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export type GlossaryEntry = {
  id: string;
  workspace_id: string;
  term: string;
  definition: string;
  category: string | null;
  first_seen_channel_id: string | null;
  first_seen_ts: string | null;
  occurrences: number;
  last_seen_at: string;
  source: "slack" | "freshdesk";
};

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    console.log(
      "[db] init: url=",
      env.supabase.url,
      "key.length=",
      env.supabase.serviceKey.length,
      "key.startsWith=",
      env.supabase.serviceKey.slice(0, 25),
    );
    _client = createClient(env.supabase.url, env.supabase.serviceKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await db().from("workspaces").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Workspace;
}

export async function getWorkspaceBySlackTeam(slackTeamId: string): Promise<Workspace | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("*")
    .eq("slack_team_id", slackTeamId)
    .maybeSingle();
  if (error) throw error;
  return (data as Workspace) ?? null;
}

export async function upsertWorkspace(input: {
  slackTeamId: string;
  slackTeamName: string;
  slackTeamDomain?: string | null;
  encryptedBotToken: string;
  encryptedUserToken?: string | null;
  installedBySlackUserId: string;
  installedBySlackUserName?: string | null;
}): Promise<Workspace> {
  const { data, error } = await db()
    .from("workspaces")
    .upsert(
      {
        slack_team_id: input.slackTeamId,
        slack_team_name: input.slackTeamName,
        slack_team_domain: input.slackTeamDomain ?? null,
        encrypted_bot_token: input.encryptedBotToken,
        encrypted_user_token: input.encryptedUserToken ?? null,
        installed_by_slack_user_id: input.installedBySlackUserId,
        installed_by_slack_user_name: input.installedBySlackUserName ?? null,
        backfill_status: "pending",
        backfill_progress: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slack_team_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function setBackfillStatus(
  workspaceId: string,
  status: Workspace["backfill_status"],
  extra: Partial<Pick<Workspace, "backfill_progress" | "backfill_total" | "backfill_error">> = {},
): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({ backfill_status: status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function bumpBackfillProgress(workspaceId: string): Promise<void> {
  await db().rpc("increment_backfill_progress", { ws_id: workspaceId }).then(() => {}, async () => {
    // Fallback if RPC not defined: read-modify-write (race-prone but OK for v0).
    const { data } = await db().from("workspaces").select("backfill_progress").eq("id", workspaceId).single();
    const next = ((data?.backfill_progress as number) ?? 0) + 1;
    await db().from("workspaces").update({ backfill_progress: next }).eq("id", workspaceId);
  });
}

export async function setWorkspaceAnthropicKey(
  workspaceId: string,
  encryptedKey: string | null,
): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      encrypted_anthropic_api_key: encryptedKey,
      anthropic_key_set_at: encryptedKey ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export type FreshdeskConnection = {
  domain: string;
  encryptedKey: string;
};

export async function setWorkspaceFreshdesk(
  workspaceId: string,
  connection: FreshdeskConnection | null,
): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      encrypted_freshdesk_api_key: connection?.encryptedKey ?? null,
      freshdesk_domain: connection?.domain ?? null,
      freshdesk_connected_at: connection ? new Date().toISOString() : null,
      freshdesk_status: connection ? "queued" : "idle",
      freshdesk_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function getWorkspaceFreshdesk(
  workspaceId: string,
): Promise<{ domain: string; encryptedKey: string } | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("freshdesk_domain, encrypted_freshdesk_api_key")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.freshdesk_domain || !data?.encrypted_freshdesk_api_key) return null;
  return {
    domain: data.freshdesk_domain as string,
    encryptedKey: data.encrypted_freshdesk_api_key as string,
  };
}

export async function getSlackContextChannelIds(workspaceId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("workspaces")
    .select("slack_context_channel_ids")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  const ids = (data?.slack_context_channel_ids as string[] | null) ?? [];
  return Array.isArray(ids) ? ids : [];
}

export async function setSlackContextChannelIds(
  workspaceId: string,
  slackChannelIds: string[],
): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      slack_context_channel_ids: slackChannelIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function getWorkspaceStripe(
  workspaceId: string,
): Promise<{ encryptedKey: string; accountId: string | null; livemode: boolean } | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("encrypted_stripe_api_key, stripe_account_id, stripe_livemode")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_stripe_api_key) return null;
  return {
    encryptedKey: data.encrypted_stripe_api_key as string,
    accountId: (data.stripe_account_id as string | null) ?? null,
    livemode: !!data.stripe_livemode,
  };
}

export async function setFreshdeskStatus(
  workspaceId: string,
  status: Workspace["freshdesk_status"],
  error: string | null = null,
): Promise<void> {
  await db()
    .from("workspaces")
    .update({
      freshdesk_status: status,
      freshdesk_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
}

export async function getWorkspaceAnthropicKey(workspaceId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("encrypted_anthropic_api_key")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.encrypted_anthropic_api_key as string | null) ?? null;
}

export async function setWorkspaceLinkupKey(
  workspaceId: string,
  encryptedKey: string | null,
): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      encrypted_linkup_api_key: encryptedKey,
      linkup_key_set_at: encryptedKey ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function getWorkspaceLinkupKey(workspaceId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("encrypted_linkup_api_key")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.encrypted_linkup_api_key as string | null) ?? null;
}

// Persist one wizard step's user-confirmed answer. `columnPatch` is the map
// returned by the step's persist() function (e.g. { company_name, company_website }).
// `contextPatch` stashes the raw Linkup payload + sources for that step into the
// `company_context.steps[stepId]` JSONB blob so the UI can show citations later.
export async function persistCompanyStep(
  workspaceId: string,
  stepId: string,
  columnPatch: Record<string, unknown>,
  contextPatch: { proposed: unknown; confirmed: unknown; sources: unknown },
): Promise<void> {
  // Read-modify-write the JSONB blob. Race-acceptable for a per-user wizard.
  const { data } = await db()
    .from("workspaces")
    .select("company_context")
    .eq("id", workspaceId)
    .maybeSingle();
  const existing = (data?.company_context as Record<string, unknown> | null) ?? {};
  const steps = ((existing.steps as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  steps[stepId] = { ...contextPatch, confirmedAt: new Date().toISOString() };
  const nextContext = { ...existing, steps };

  const { error } = await db()
    .from("workspaces")
    .update({ ...columnPatch, company_context: nextContext, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function finishCompanyResolution(workspaceId: string): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      company_resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function resetCompanyResolution(workspaceId: string): Promise<void> {
  const { error } = await db()
    .from("workspaces")
    .update({
      company_resolved_at: null,
      company_context: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function bumpLastEventReceivedAt(workspaceId: string): Promise<void> {
  await db()
    .from("workspaces")
    .update({ last_event_received_at: new Date().toISOString() })
    .eq("id", workspaceId);
}

export async function listChannels(workspaceId: string): Promise<Channel[]> {
  const { data, error } = await db()
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("message_count_6mo", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export async function upsertChannels(
  workspaceId: string,
  rows: Array<{
    slack_channel_id: string;
    name: string;
    topic?: string | null;
    purpose_native?: string | null;
    archived?: boolean;
    is_private?: boolean;
  }>,
): Promise<Channel[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db()
    .from("channels")
    .upsert(
      rows.map((r) => ({
        workspace_id: workspaceId,
        slack_channel_id: r.slack_channel_id,
        name: r.name,
        topic: r.topic ?? null,
        purpose_native: r.purpose_native ?? null,
        archived: r.archived ?? false,
        is_private: r.is_private ?? false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "workspace_id,slack_channel_id" },
    )
    .select("*");
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export async function updateChannel(
  channelId: string,
  patch: Partial<Pick<Channel, "purpose_extracted" | "category" | "message_count_6mo" | "unique_contributors" | "last_message_at" | "archived">>,
): Promise<void> {
  const { error } = await db()
    .from("channels")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", channelId);
  if (error) throw error;
}

export async function bulkUpdateChannelCategories(
  workspaceId: string,
  cats: Array<{ slack_channel_id: string; category: string }>,
): Promise<void> {
  for (const c of cats) {
    await db()
      .from("channels")
      .update({ category: c.category, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("slack_channel_id", c.slack_channel_id);
  }
}

export async function listGlossary(workspaceId: string): Promise<GlossaryEntry[]> {
  const { data, error } = await db()
    .from("glossary_entries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurrences", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as GlossaryEntry[];
}

export async function upsertGlossary(
  workspaceId: string,
  entries: Array<{
    term: string;
    definition: string;
    category?: string | null;
    first_seen_channel_id?: string | null;
    first_seen_ts?: string | null;
    occurrences?: number;
    source?: "slack" | "freshdesk";
  }>,
): Promise<void> {
  if (entries.length === 0) return;
  for (const e of entries) {
    const { data: existing } = await db()
      .from("glossary_entries")
      .select("id, occurrences, first_seen_channel_id, first_seen_ts")
      .eq("workspace_id", workspaceId)
      .eq("term", e.term)
      .maybeSingle();

    if (existing) {
      await db()
        .from("glossary_entries")
        .update({
          definition: e.definition,
          category: e.category ?? null,
          occurrences: (existing.occurrences as number) + (e.occurrences ?? 1),
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id as string);
    } else {
      await db().from("glossary_entries").insert({
        workspace_id: workspaceId,
        term: e.term,
        definition: e.definition,
        category: e.category ?? null,
        first_seen_channel_id: e.first_seen_channel_id ?? null,
        first_seen_ts: e.first_seen_ts ?? null,
        occurrences: e.occurrences ?? 1,
        source: e.source ?? "slack",
      });
    }
  }
}

export async function getKnownTerms(workspaceId: string, terms: string[]): Promise<Set<string>> {
  if (terms.length === 0) return new Set();
  const { data, error } = await db()
    .from("glossary_entries")
    .select("term")
    .eq("workspace_id", workspaceId)
    .in("term", terms);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.term as string));
}

export async function bumpOccurrences(workspaceId: string, terms: string[]): Promise<void> {
  if (terms.length === 0) return;
  for (const t of terms) {
    const { data } = await db()
      .from("glossary_entries")
      .select("id, occurrences")
      .eq("workspace_id", workspaceId)
      .eq("term", t)
      .maybeSingle();
    if (data) {
      await db()
        .from("glossary_entries")
        .update({
          occurrences: (data.occurrences as number) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", data.id as string);
    }
  }
}

export type SkillSource = "slack" | "freshdesk" | "manual";

export type Skill = {
  id: string;
  workspace_id: string;
  type: "process" | "policy" | "decision" | "escalation" | "faq" | "runbook" | "procedure";
  domain: string | null;
  slug: string;
  title: string;
  trigger: string | null;
  steps_md: string | null;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet?: string; url?: string }>;
  source: SkillSource;
  source_count: number;
  confidence: number;
  last_observed_at: string | null;
  first_observed_at: string | null;
  status: "draft" | "active" | "superseded";
  superseded_by: string | null;
  merged_into: string | null;
  merged_reason: string | null;
  applied_count: number;
  last_applied_at: string | null;
  last_modification_proposed: string | null;
  created_at: string;
  updated_at: string;
};

// Feedback loop: signal sent by an installed skill (CLI/agent) when used.
export type SkillFeedback = {
  id: string;
  workspace_id: string;
  skill_id: string;
  skill_slug: string;
  applied: boolean;
  rating: number | null;
  modification_proposed: string | null;
  context: string | null;
  source: "agent" | "cli" | "manual";
  created_at: string;
};

export async function recordSkillFeedback(input: {
  workspaceId: string;
  skillSlug: string;
  applied?: boolean;
  rating?: number | null;
  modificationProposed?: string | null;
  context?: string | null;
  source?: SkillFeedback["source"];
}): Promise<{ feedbackId: string; skillId: string; appliedCount: number } | null> {
  // Resolve skill_id from slug (active or draft, never superseded).
  const { data: skill, error: skillErr } = await db()
    .from("skills")
    .select("id, applied_count")
    .eq("workspace_id", input.workspaceId)
    .eq("slug", input.skillSlug)
    .neq("status", "superseded")
    .maybeSingle();
  if (skillErr) throw skillErr;
  if (!skill) return null;

  const now = new Date().toISOString();
  const applied = input.applied ?? true;

  const { data: fb, error: fbErr } = await db()
    .from("skill_feedback")
    .insert({
      workspace_id: input.workspaceId,
      skill_id: skill.id as string,
      skill_slug: input.skillSlug,
      applied,
      rating: input.rating ?? null,
      modification_proposed: input.modificationProposed ?? null,
      context: input.context ?? null,
      source: input.source ?? "agent",
    })
    .select("id")
    .single();
  if (fbErr) throw fbErr;

  const nextCount = ((skill.applied_count as number | null) ?? 0) + (applied ? 1 : 0);
  await db()
    .from("skills")
    .update({
      applied_count: nextCount,
      last_applied_at: applied ? now : undefined,
      last_modification_proposed: input.modificationProposed ?? undefined,
      updated_at: now,
    })
    .eq("id", skill.id as string);

  return { feedbackId: fb.id as string, skillId: skill.id as string, appliedCount: nextCount };
}

// ---------- Agent runs (support co-pilot) ----------

export type AgentRun = {
  id: string;
  workspace_id: string;
  ticket_id: number;
  ticket_subject: string;
  ticket_url: string | null;
  ticket_body: string | null;
  requester_email: string | null;
  ticket_priority: number | null;
  ticket_created_at: string | null;
  urgency: "low" | "medium" | "high" | "critical" | null;
  category: string | null;
  draft_original: string | null;
  draft_sent: string | null;
  reasoning: string | null;
  matched_skill_slugs: string[];
  status: "pending" | "sent" | "rejected" | "failed";
  rejection_reason: string | null;
  diff_distance: number | null;
  outcome: "sent_unchanged" | "sent_edited" | "rejected" | "failed" | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sent_at: string | null;
};

export async function createAgentRun(input: {
  workspaceId: string;
  ticketId: number;
  ticketSubject: string;
  ticketUrl: string | null;
  ticketBody: string | null;
  requesterEmail: string | null;
  ticketPriority: number | null;
  ticketCreatedAt: string | null;
  urgency: AgentRun["urgency"];
  category: string | null;
  draftOriginal: string | null;
  reasoning: string | null;
  matchedSkillSlugs: string[];
  status: AgentRun["status"];
  /** When true and a row already exists for (workspace_id, ticket_id), the
   * existing row is OVERWRITTEN with the new draft/reasoning/etc. Used when
   * an earlier tick left an orphan (draft_original=null) and we want a fresh
   * attempt now that context is richer (Slack channels configured, prompt
   * loosened, etc.). Default false = preserve historical behaviour. */
  upsert?: boolean;
}): Promise<AgentRun | null> {
  const payload = {
    workspace_id: input.workspaceId,
    ticket_id: input.ticketId,
    ticket_subject: input.ticketSubject,
    ticket_url: input.ticketUrl,
    ticket_body: input.ticketBody,
    requester_email: input.requesterEmail,
    ticket_priority: input.ticketPriority,
    ticket_created_at: input.ticketCreatedAt,
    urgency: input.urgency,
    category: input.category,
    draft_original: input.draftOriginal,
    reasoning: input.reasoning,
    matched_skill_slugs: input.matchedSkillSlugs,
    status: input.status,
  };
  const builder = input.upsert
    ? db().from("agent_runs").upsert(payload, { onConflict: "workspace_id,ticket_id" })
    : db().from("agent_runs").insert(payload);
  const { data, error } = await builder
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data as AgentRun;
}

export async function listAgentRuns(
  workspaceId: string,
  opts: { status?: AgentRun["status"][]; limit?: number } = {},
): Promise<AgentRun[]> {
  let q = db()
    .from("agent_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("ticket_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status && opts.status.length > 0) q = q.in("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AgentRun[];
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  const { data, error } = await db().from("agent_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw error;
  return (data as AgentRun) ?? null;
}

export async function markAgentRunSent(
  runId: string,
  draftSent: string,
  diffDistance: number,
  reviewedBy: string | null,
): Promise<void> {
  const outcome: AgentRun["outcome"] = diffDistance < 0.05 ? "sent_unchanged" : "sent_edited";
  const now = new Date().toISOString();
  const { error } = await db()
    .from("agent_runs")
    .update({
      draft_sent: draftSent,
      diff_distance: diffDistance,
      outcome,
      status: "sent",
      reviewed_at: now,
      reviewed_by: reviewedBy,
      sent_at: now,
    })
    .eq("id", runId);
  if (error) throw error;
}

export async function markAgentRunRejected(
  runId: string,
  reason: string | null,
  reviewedBy: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("agent_runs")
    .update({
      status: "rejected",
      rejection_reason: reason,
      outcome: "rejected",
      reviewed_at: now,
      reviewed_by: reviewedBy,
    })
    .eq("id", runId);
  if (error) throw error;
}

export async function setLastAgentTick(workspaceId: string, at: string): Promise<void> {
  await db().from("workspaces").update({ last_agent_tick_at: at }).eq("id", workspaceId);
}

// ---------- Freshdesk early-warning signals ----------

export type FreshdeskSignal = {
  id: string;
  workspace_id: string;
  ticket_id: number;
  ticket_subject: string;
  ticket_url: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  category:
    | "complaint"
    | "bug"
    | "unknown_intent"
    | "sentiment_negative"
    | "spike"
    | "churn_risk"
    | "other";
  reason: string;
  matched_skill_slug: string | null;
  matched_skill_confidence: number | null;
  status: "new" | "acknowledged" | "resolved" | "dismissed";
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  requester_email: string | null;
  ticket_created_at: string | null;
  ticket_priority: number | null;
};

export async function upsertFreshdeskSignals(
  workspaceId: string,
  signals: Array<{
    ticketId: number;
    ticketSubject: string;
    ticketUrl: string | null;
    urgency: FreshdeskSignal["urgency"];
    category: FreshdeskSignal["category"];
    reason: string;
    matchedSkillSlug: string | null;
    matchedSkillConfidence: number | null;
    requesterEmail?: string | null;
    ticketCreatedAt?: string | null;
    ticketPriority?: number | null;
  }>,
): Promise<{ inserted: number; updated: number }> {
  if (signals.length === 0) return { inserted: 0, updated: 0 };
  const rows = signals.map((s) => ({
    workspace_id: workspaceId,
    ticket_id: s.ticketId,
    ticket_subject: s.ticketSubject,
    ticket_url: s.ticketUrl,
    urgency: s.urgency,
    category: s.category,
    reason: s.reason,
    matched_skill_slug: s.matchedSkillSlug,
    matched_skill_confidence: s.matchedSkillConfidence,
    requester_email: s.requesterEmail ?? null,
    ticket_created_at: s.ticketCreatedAt ?? null,
    ticket_priority: s.ticketPriority ?? null,
  }));
  const { error, count } = await db()
    .from("freshdesk_signals")
    .upsert(rows, { onConflict: "workspace_id,ticket_id", count: "exact" });
  if (error) throw error;
  return { inserted: count ?? rows.length, updated: 0 };
}

export async function listFreshdeskSignals(
  workspaceId: string,
  opts: {
    status?: FreshdeskSignal["status"][];
    limit?: number;
    /** Only signals where ticket_created_at >= now() - sinceDays */
    sinceDays?: number;
  } = {},
): Promise<FreshdeskSignal[]> {
  let query = db()
    .from("freshdesk_signals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("ticket_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status && opts.status.length > 0) {
    query = query.in("status", opts.status);
  }
  if (typeof opts.sinceDays === "number" && opts.sinceDays > 0) {
    const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("ticket_created_at", cutoff);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FreshdeskSignal[];
}

export async function setFreshdeskSignalStatus(
  workspaceId: string,
  signalId: string,
  status: FreshdeskSignal["status"],
  acknowledgedBy: string | null = null,
): Promise<void> {
  const { error } = await db()
    .from("freshdesk_signals")
    .update({
      status,
      acknowledged_at: status === "acknowledged" || status === "resolved" ? new Date().toISOString() : null,
      acknowledged_by: acknowledgedBy,
    })
    .eq("id", signalId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}

export async function listRecentFeedback(
  workspaceId: string,
  limit = 20,
): Promise<SkillFeedback[]> {
  const { data, error } = await db()
    .from("skill_feedback")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SkillFeedback[];
}

export async function listSkills(workspaceId: string): Promise<Skill[]> {
  const { data, error } = await db()
    .from("skills")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "superseded")
    .order("confidence", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Skill[];
}

export async function getSkill(workspaceId: string, slug: string): Promise<Skill | null> {
  const { data, error } = await db()
    .from("skills")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .neq("status", "superseded")
    .maybeSingle();
  if (error) throw error;
  return (data as Skill) ?? null;
}

export async function upsertSkill(
  workspaceId: string,
  s: {
    type: Skill["type"];
    domain?: string | null;
    slug: string;
    title: string;
    trigger: string;
    steps_md: string;
    decision_criteria: string | null;
    escalation: string | null;
    citations: Array<{ channel_id: string; ts: string; snippet?: string; url?: string }>;
    source?: SkillSource;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await db()
    .from("skills")
    .select("id, source_count, citations, first_observed_at")
    .eq("workspace_id", workspaceId)
    .eq("slug", s.slug)
    .maybeSingle();

  if (existing) {
    // Merge citations (dedupe by ts), bump source_count + recompute confidence.
    const existingCitations = (existing.citations as Skill["citations"]) ?? [];
    const seenTs = new Set(existingCitations.map((c) => c.ts));
    const merged = [...existingCitations];
    for (const c of s.citations) {
      if (!seenTs.has(c.ts)) {
        merged.push(c);
        seenTs.add(c.ts);
      }
    }
    const newSourceCount = (existing.source_count as number) + 1;
    // A skill we observed in actual messages/tickets is by definition real —
    // confidence stays at 1.0. The decision criteria + escalation paths ARE
    // the validation. Lower the score only when explicitly marked as draft
    // (e.g. user-flagged for review) — never as a decay over time.
    const confidence = 1.0;

    await db()
      .from("skills")
      .update({
        title: s.title,
        domain: s.domain ?? null,
        trigger: s.trigger,
        steps_md: s.steps_md,
        decision_criteria: s.decision_criteria,
        escalation: s.escalation,
        citations: merged,
        source_count: newSourceCount,
        confidence,
        last_observed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id as string);
  } else {
    await db().from("skills").insert({
      workspace_id: workspaceId,
      type: s.type,
      domain: s.domain ?? null,
      slug: s.slug,
      title: s.title,
      trigger: s.trigger,
      steps_md: s.steps_md,
      decision_criteria: s.decision_criteria,
      escalation: s.escalation,
      citations: s.citations,
      source: s.source ?? "slack",
      source_count: 1,
      confidence: 1.0,
      first_observed_at: now,
      last_observed_at: now,
      status: "draft",
    });
  }
}

export async function createSkill(
  workspaceId: string,
  s: {
    type: Skill["type"];
    domain?: string | null;
    slug: string;
    title: string;
    trigger?: string | null;
    steps_md?: string | null;
    decision_criteria?: string | null;
    escalation?: string | null;
  },
): Promise<Skill> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("skills")
    .insert({
      workspace_id: workspaceId,
      type: s.type,
      domain: s.domain ?? null,
      slug: s.slug,
      title: s.title,
      trigger: s.trigger ?? null,
      steps_md: s.steps_md ?? null,
      decision_criteria: s.decision_criteria ?? null,
      escalation: s.escalation ?? null,
      citations: [],
      source: "manual",
      source_count: 1,
      confidence: 1.0,
      first_observed_at: now,
      last_observed_at: now,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Skill;
}

export async function updateSkill(
  workspaceId: string,
  skillId: string,
  patch: Partial<Pick<Skill, "type" | "domain" | "slug" | "title" | "trigger" | "steps_md" | "decision_criteria" | "escalation" | "status">>,
): Promise<Skill> {
  const { data, error } = await db()
    .from("skills")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", skillId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Skill;
}

export async function deleteSkill(workspaceId: string, skillId: string): Promise<void> {
  const { error } = await db()
    .from("skills")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", skillId);
  if (error) throw error;
}

function titleSimilarity(a: string, b: string): number {
  const stopWords = new Set(["a","an","the","for","and","or","of","in","on","to","from","with","by","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","shall","should","may","might","can","could","this","that","these","those","it","its","de","le","la","les","des","du","un","une","et","ou","en","dans","sur","pour","par","ce","se","ne","pas","que","qui"]);
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9À-ÿ\s]/g, "").split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

export async function mergeDraftSkills(workspaceId: string, logger?: { info: (msg: string) => void }): Promise<{ merged: number; promoted: number }> {
  const { data: drafts, error } = await db()
    .from("skills")
    .select("id, title, slug, type, source_count, confidence, citations, steps_md, trigger, decision_criteria, escalation, domain, source, first_observed_at, last_observed_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "draft")
    .is("merged_into", null)
    .order("source_count", { ascending: false });
  if (error) throw error;
  if (!drafts || drafts.length < 2) return { merged: 0, promoted: 0 };

  const SIMILARITY_THRESHOLD = 0.55;
  const used = new Set<string>();
  let merged = 0;

  for (let i = 0; i < drafts.length; i++) {
    if (used.has(drafts[i].id)) continue;
    for (let j = i + 1; j < drafts.length; j++) {
      if (used.has(drafts[j].id)) continue;
      const sim = titleSimilarity(drafts[i].title, drafts[j].title);
      if (sim < SIMILARITY_THRESHOLD) continue;

      const keeper = (drafts[i].source_count as number) >= (drafts[j].source_count as number) ? drafts[i] : drafts[j];
      const goner = keeper.id === drafts[i].id ? drafts[j] : drafts[i];

      const keeperCitations = (keeper.citations as Skill["citations"]) ?? [];
      const gonerCitations = (goner.citations as Skill["citations"]) ?? [];
      const seenTs = new Set(keeperCitations.map(c => c.ts));
      const mergedCitations = [...keeperCitations];
      for (const c of gonerCitations) {
        if (!seenTs.has(c.ts)) { mergedCitations.push(c); seenTs.add(c.ts); }
      }

      const newSourceCount = (keeper.source_count as number) + (goner.source_count as number);
      const newConfidence = 1.0;

      await db().from("skills").update({
        citations: mergedCitations,
        source_count: newSourceCount,
        confidence: newConfidence,
        updated_at: new Date().toISOString(),
      }).eq("id", keeper.id);

      await db().from("skills").update({
        status: "superseded",
        merged_into: keeper.id,
        merged_reason: `merged into "${keeper.title}" (title similarity ${(sim * 100).toFixed(0)}%)`,
        superseded_by: keeper.id,
        updated_at: new Date().toISOString(),
      }).eq("id", goner.id);

      used.add(goner.id);
      merged++;
      logger?.info(`Merged "${goner.title}" → "${keeper.title}" (${(sim * 100).toFixed(0)}% similar)`);
    }
  }

   let promoted = 0;
   const { data: strongDrafts } = await db()
     .from("skills")
     .select("id, title, source_count, confidence, trigger, steps_md, decision_criteria, escalation")
     .eq("workspace_id", workspaceId)
     .eq("status", "draft")
     .is("merged_into", null);

  if (strongDrafts) {
    for (const d of strongDrafts) {
      const hasAllFields = d.trigger && d.steps_md && d.steps_md.length > 50;
      if (!hasAllFields) continue;
      await db().from("skills").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", d.id);
      promoted++;
      logger?.info(`Promoted "${d.title}" to active (confidence=${d.confidence}, sources=${d.source_count})`);
    }
  }

  return { merged, promoted };
}

export async function markChannelSkillsExtracted(
  workspaceId: string,
  channelDbId: string,
  oldestTs: string,
  latestTs: string,
  skillsFound: number,
): Promise<void> {
  await db()
    .from("skill_extractions")
    .upsert(
      {
        workspace_id: workspaceId,
        channel_id: channelDbId,
        oldest_msg_ts: oldestTs,
        latest_msg_ts: latestTs,
        skills_found: skillsFound,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,channel_id" },
    );
}

export type Person = {
  id: string;
  workspace_id: string;
  slack_user_id: string;
  display_name: string | null;
  real_name: string | null;
  title: string | null;
  email: string | null;
  avatar_url: string | null;
  is_bot: boolean;
  is_deleted: boolean;
  role_extracted: string | null;
  summary: string | null;
  tools: string[];
  expertise: string[];
  top_channels: Array<{ slack_channel_id: string; name: string; count: number }>;
  message_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  confidence: number;
  status: "draft" | "active" | "superseded" | "former";
  created_at: string;
  updated_at: string;
};

export async function listPeople(
  workspaceId: string,
  opts: { includeFormer?: boolean } = {},
): Promise<Person[]> {
  let query = db()
    .from("people")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_bot", false)
    .eq("is_deleted", false)
    .order("message_count", { ascending: false });
  if (!opts.includeFormer) query = query.neq("status", "former");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Person[];
}

export async function bumpPersonActivity(
  workspaceId: string,
  slackUserId: string,
  slackChannelId: string,
  delta: number,
  lastMessageTs: string | null,
): Promise<void> {
  // Upsert with manual count merge — Supabase doesn't have native increment via REST.
  const { data: existing } = await db()
    .from("people_activity")
    .select("message_count, last_message_ts")
    .eq("workspace_id", workspaceId)
    .eq("slack_user_id", slackUserId)
    .eq("slack_channel_id", slackChannelId)
    .maybeSingle();

  if (existing) {
    const newCount = (existing.message_count as number) + delta;
    const newLast =
      lastMessageTs && (!existing.last_message_ts || lastMessageTs > (existing.last_message_ts as string))
        ? lastMessageTs
        : (existing.last_message_ts as string | null);
    await db()
      .from("people_activity")
      .update({
        message_count: newCount,
        last_message_ts: newLast,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("slack_user_id", slackUserId)
      .eq("slack_channel_id", slackChannelId);
  } else {
    await db().from("people_activity").insert({
      workspace_id: workspaceId,
      slack_user_id: slackUserId,
      slack_channel_id: slackChannelId,
      message_count: delta,
      last_message_ts: lastMessageTs,
    });
  }
}

export async function listActiveUsers(
  workspaceId: string,
  minMessages = 3,
): Promise<
  Array<{
    slack_user_id: string;
    total_messages: number;
    channels: Array<{ slack_channel_id: string; count: number; last_ts: string | null }>;
  }>
> {
  const { data, error } = await db()
    .from("people_activity")
    .select("slack_user_id, slack_channel_id, message_count, last_message_ts")
    .eq("workspace_id", workspaceId);
  if (error) throw error;

  const map = new Map<
    string,
    { total: number; channels: Array<{ slack_channel_id: string; count: number; last_ts: string | null }> }
  >();
  for (const row of data ?? []) {
    const u = row.slack_user_id as string;
    const c = row.slack_channel_id as string;
    const cnt = (row.message_count as number) ?? 0;
    const ts = (row.last_message_ts as string | null) ?? null;
    const existing = map.get(u) ?? { total: 0, channels: [] };
    existing.total += cnt;
    existing.channels.push({ slack_channel_id: c, count: cnt, last_ts: ts });
    map.set(u, existing);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.total >= minMessages)
    .map(([slack_user_id, v]) => ({ slack_user_id, total_messages: v.total, channels: v.channels }));
}

export async function upsertPerson(
  workspaceId: string,
  data: Partial<Person> & { slack_user_id: string },
): Promise<void> {
  const { error } = await db()
    .from("people")
    .upsert(
      {
        workspace_id: workspaceId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,slack_user_id" },
    );
  if (error) throw error;
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("processed_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markEventProcessed(eventId: string, workspaceId: string | null): Promise<void> {
  await db().from("processed_events").upsert({ event_id: eventId, workspace_id: workspaceId });
}
