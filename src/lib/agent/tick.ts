// Single-workspace tick logic, reusable from both Inngest (hourly cron)
// and the manual "Scan now" API route. Returns a structured result so the
// caller can render a useful status (the UI shows "drafted 6 of 12 open
// tickets, 4 already had drafts, 2 failed: <reason>").

import {
  db,
  getWorkspace,
  getWorkspaceFreshdesk,
  getWorkspaceStripe,
  getSlackContextChannelIds,
  listChannels,
  listSkills,
  createAgentRun,
  setLastAgentTick,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { slackUserOrBotClient } from "@/lib/slack";
import { draftReply, selectCandidateSkills } from "./runtime";
import { maybeFetchStripeContext } from "./stripe-context";
import { buildSlackContextBlock } from "./slack-context";

const OPEN_STATUSES = new Set([2, 3]);
export const MAX_DRAFTS_PER_TICK = 20;

export type TickResult = {
  workspaceId: string;
  skipped?: string;
  // Number of tickets pulled from Freshdesk
  pulled: number;
  // Open + non-spam subset of pulled tickets
  candidates: number;
  // Of the candidates, how many already had an agent_run
  alreadyDrafted: number;
  // Of the remaining, how many were attempted in this tick
  attempted: number;
  // How many succeeded (created an agent_run)
  drafted: number;
  // How many failed to draft (LLM/serialization error, etc.) with reasons
  failures: Array<{ ticketId: number; reason: string }>;
};

export async function tickWorkspace(workspaceId: string): Promise<TickResult> {
  const result: TickResult = {
    workspaceId,
    pulled: 0,
    candidates: 0,
    alreadyDrafted: 0,
    attempted: 0,
    drafted: 0,
    failures: [],
  };

  const conn = await getWorkspaceFreshdesk(workspaceId);
  if (!conn) {
    result.skipped = "freshdesk not connected";
    return result;
  }

  const fd = new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));

  const tickets = await fd
    .listRecentTickets({ perPage: 100, pages: 1 })
    .catch((e) => {
      throw new Error(`Freshdesk list failed: ${(e as Error).message}`);
    });
  result.pulled = tickets.length;

  const candidates = tickets.filter(
    (t) => OPEN_STATUSES.has(t.status) && !(t as { spam?: boolean }).spam,
  );
  result.candidates = candidates.length;

  if (candidates.length === 0) {
    await setLastAgentTick(workspaceId, new Date().toISOString());
    return result;
  }

  const ticketIds = candidates.map((t) => t.id);
  const { data: existingRuns } = await db()
    .from("agent_runs")
    .select("ticket_id")
    .eq("workspace_id", workspaceId)
    .in("ticket_id", ticketIds);
  const alreadyDrafted = new Set(
    (existingRuns ?? []).map((r) => r.ticket_id as number),
  );
  result.alreadyDrafted = alreadyDrafted.size;

  const toDraft = candidates
    .filter((t) => !alreadyDrafted.has(t.id))
    .slice(0, MAX_DRAFTS_PER_TICK);
  result.attempted = toDraft.length;

  if (toDraft.length === 0) {
    await setLastAgentTick(workspaceId, new Date().toISOString());
    return result;
  }

  const ws = await getWorkspace(workspaceId);
  const apiKey = await loadWorkspaceApiKey(workspaceId);
  const allSkills = await listSkills(workspaceId);
  const stripeConn = await getWorkspaceStripe(workspaceId);

  // Slack context: fetch the last ~30 messages from each nominated channel
  // ONCE per tick (not per ticket) — same context applies to every ticket
  // drafted in this batch. Tokens cost is amortised across all drafts.
  let slackContextBlock: string | null = null;
  try {
    const contextChannelIds = await getSlackContextChannelIds(workspaceId);
    if (contextChannelIds.length > 0) {
      const allChannels = await listChannels(workspaceId);
      const selectedChannels = allChannels
        .filter((c) => contextChannelIds.includes(c.slack_channel_id))
        .map((c) => ({ slack_channel_id: c.slack_channel_id, name: c.name }));
      if (selectedChannels.length > 0) {
        const { client: slack } = slackUserOrBotClient({
          encrypted_user_token: ws.encrypted_user_token,
          encrypted_bot_token: ws.encrypted_bot_token,
        });
        slackContextBlock = await buildSlackContextBlock(slack, selectedChannels, 30);
      }
    }
  } catch {
    // Slack fetch failures don't block drafting — drafts work without this
    // context, just less grounded. Caller can see via debug if needed.
  }

  for (const ticket of toDraft) {
    const candidateSkills = selectCandidateSkills(ticket, allSkills, 20);

    const stripeContext = await maybeFetchStripeContext(
      ticket,
      stripeConn?.encryptedKey ?? null,
      decrypt,
    ).catch(() => null);

    let draftResult;
    try {
      draftResult = await draftReply({
        workspace: ws,
        ticket,
        candidateSkills,
        stripeContext: stripeContext ?? undefined,
        slackContext: slackContextBlock ?? undefined,
        apiKey,
      });
    } catch (e) {
      result.failures.push({
        ticketId: ticket.id,
        reason: (e as Error).message ?? "draft error",
      });
      continue;
    }

    const created = await createAgentRun({
      workspaceId,
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      ticketUrl: fd.ticketUrl(ticket.id),
      ticketBody: ticket.description_text ?? null,
      requesterEmail: ticket.requester?.email ?? null,
      ticketPriority: ticket.priority,
      ticketCreatedAt: ticket.created_at,
      urgency: draftResult.urgency,
      category: draftResult.category,
      draftOriginal: draftResult.draft,
      reasoning: draftResult.reasoning,
      matchedSkillSlugs: draftResult.matchedSkillSlugs,
      status: draftResult.decision === "spam" ? "rejected" : "pending",
    });
    if (created) result.drafted += 1;
  }

  await setLastAgentTick(workspaceId, new Date().toISOString());
  return result;
}
