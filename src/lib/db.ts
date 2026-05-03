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

export async function getWorkspaceAnthropicKey(workspaceId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("workspaces")
    .select("encrypted_anthropic_api_key")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.encrypted_anthropic_api_key as string | null) ?? null;
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
  }>,
): Promise<void> {
  if (entries.length === 0) return;
  // Upsert: keep earliest first_seen, sum occurrences.
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

export type Skill = {
  id: string;
  workspace_id: string;
  type: "process" | "policy" | "decision" | "escalation";
  domain: string | null;
  slug: string;
  title: string;
  trigger: string | null;
  steps_md: string | null;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet?: string }>;
  source_count: number;
  confidence: number;
  last_observed_at: string | null;
  first_observed_at: string | null;
  status: "draft" | "active" | "superseded";
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

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
    citations: Array<{ channel_id: string; ts: string; snippet?: string }>;
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
    const confidence = Math.min(0.99, 0.4 + 0.1 * Math.log2(newSourceCount + 1));

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
      source_count: 1,
      confidence: 0.5,
      first_observed_at: now,
      last_observed_at: now,
      status: "draft",
    });
  }
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
