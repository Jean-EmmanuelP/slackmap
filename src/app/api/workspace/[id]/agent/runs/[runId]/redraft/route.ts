// Force re-draft of a single agent_run. Useful when:
//   - the prompt has been updated and you want the latest behaviour on an
//     old draft (e.g. action plan added after the run was created)
//   - the agent escalated when more context is now available
//
// The endpoint loads the run, fetches the original ticket from Freshdesk
// (always live — the cached ticket_body may be stale), runs draftReply
// with current skills + Stripe + Slack context, and upserts the run with
// the fresh output.

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  getAgentRun,
  getWorkspace,
  getWorkspaceFreshdesk,
  getWorkspaceStripe,
  getSlackContextChannelIds,
  listChannels,
  listSkills,
  createAgentRun,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { slackUserOrBotClient } from "@/lib/slack";
import { draftReply, selectCandidateSkills } from "@/lib/agent/runtime";
import { maybeFetchStripeContext } from "@/lib/agent/stripe-context";
import { buildSlackContextBlock } from "@/lib/agent/slack-context";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id: workspaceId, runId } = await params;

  const user = await getSessionUser();
  if (user && !(await userIsAdmin(workspaceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const run = await getAgentRun(runId);
  if (!run || run.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.status !== "pending") {
    return NextResponse.json(
      { error: `cannot re-draft a ${run.status} run — only pending` },
      { status: 400 },
    );
  }

  const fdConn = await getWorkspaceFreshdesk(workspaceId);
  if (!fdConn) {
    return NextResponse.json({ error: "freshdesk not connected" }, { status: 400 });
  }

  const fd = new FreshdeskClient(fdConn.domain, decrypt(fdConn.encryptedKey));

  // Re-fetch the ticket so we work on current state (status may have changed,
  // customer may have replied since the original draft).
  let ticket;
  try {
    ticket = await fd.getTicket(run.ticket_id);
  } catch (e) {
    return NextResponse.json(
      { error: `freshdesk fetch failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const [ws, apiKey, allSkills, stripeConn, contextChannelIds] = await Promise.all([
    getWorkspace(workspaceId),
    loadWorkspaceApiKey(workspaceId),
    listSkills(workspaceId),
    getWorkspaceStripe(workspaceId),
    getSlackContextChannelIds(workspaceId),
  ]);

  // Build the Slack context block (same logic as tick.ts, one-shot for this ticket)
  let slackContextBlock: string | null = null;
  if (contextChannelIds.length > 0) {
    try {
      const allChannels = await listChannels(workspaceId);
      const selected = allChannels
        .filter((c) => contextChannelIds.includes(c.slack_channel_id))
        .map((c) => ({ slack_channel_id: c.slack_channel_id, name: c.name }));
      if (selected.length > 0) {
        const { client: slack } = slackUserOrBotClient({
          encrypted_user_token: ws.encrypted_user_token,
          encrypted_bot_token: ws.encrypted_bot_token,
        });
        slackContextBlock = await buildSlackContextBlock(slack, selected, 30);
      }
    } catch {
      // partial context > no context
    }
  }

  const stripeContext = await maybeFetchStripeContext(
    ticket,
    stripeConn?.encryptedKey ?? null,
    decrypt,
  ).catch(() => null);

  const candidateSkills = selectCandidateSkills(ticket, allSkills, 20);

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
    return NextResponse.json(
      { error: `draft failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Upsert — overwrite the existing row in place. The unique (workspace_id,
  // ticket_id) constraint guarantees we update the right one.
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
    proposedActions: draftResult.proposedActions,
    status: draftResult.decision === "spam" ? "rejected" : "pending",
    upsert: true,
  });

  return NextResponse.json({
    ok: true,
    runId: created?.id ?? run.id,
    actionsCount: draftResult.proposedActions.length,
  });
}

// Quiet TS unused — `db` is reserved for future audit logging.
void db;
