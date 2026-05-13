import { inngest } from "./client";
import {
  db,
  getWorkspace,
  getWorkspaceFreshdesk,
  getWorkspaceStripe,
  listSkills,
  createAgentRun,
  setLastAgentTick,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { draftReply, selectCandidateSkills } from "@/lib/agent/runtime";
import { maybeFetchStripeContext } from "@/lib/agent/stripe-context";

// Hourly + on-demand sweep. For each workspace with Freshdesk connected:
//
//   1. Pull the 100 most recently updated tickets
//   2. Keep only open / pending ones (status 2 + 3); drop closed, resolved, spam
//   3. Skip tickets that ALREADY have an agent_run (any status) — we draft each
//      ticket exactly once for v1. Customer reply triggering a re-draft is a v2.
//   4. Cap to MAX_DRAFTS_PER_TICK to bound LLM cost per run
//   5. For each survivor: pre-fetch Stripe context (billing tickets only),
//      call draftReply, persist as agent_run with status=pending.
//
// This model means: as soon as the workspace is connected, the next tick
// backfills the entire open inbox — the user sees drafts on first visit,
// not "wait until something new arrives."
//
// Idempotent via the unique (workspace_id, ticket_id) constraint on
// agent_runs — re-running on the same ticket is a no-op.
//
// Open Freshdesk ticket statuses:
//   2 = Open, 3 = Pending, 4 = Resolved, 5 = Closed
const OPEN_STATUSES = new Set([2, 3]);

// Bound LLM cost per tick. 20 drafts × ~1500 output tokens ≈ 30k tokens/tick
// per workspace. Hourly = 720k tokens/day worst case. Anything above this
// suggests volume that should move to native tool-use with streaming.
const MAX_DRAFTS_PER_TICK = 20;

export const agentTick = inngest.createFunction(
  {
    id: "agent-tick",
    // Every hour on the hour. Also listens on `agent/tick.manual` so the
    // "Scan now" button on /freshdesk can force an immediate tick without
    // waiting for the cron.
    triggers: [
      { cron: "0 * * * *" },
      { event: "agent/tick.manual" },
    ],
  },
  async ({ step, logger }) => {
    const { data: workspaces } = await db()
      .from("workspaces")
      .select("id, freshdesk_domain")
      .not("freshdesk_domain", "is", null);
    if (!workspaces || workspaces.length === 0) return { skipped: "no workspaces" };

    let totalQueued = 0;
    for (const w of workspaces) {
      const wsId = w.id as string;
      const result = await step.run(`tick-${wsId}`, async () => {
        const conn = await getWorkspaceFreshdesk(wsId);
        if (!conn) return { workspaceId: wsId, queued: 0, skipped: "no freshdesk" };

        const fd = new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));

        // Pull last 100 most-recently-updated tickets. We don't use a
        // since-timestamp window here on purpose — we want to backfill
        // any open ticket without a draft, not only "new" ones.
        const recentTickets = await fd
          .listRecentTickets({ perPage: 100, pages: 1 })
          .catch((e) => {
            logger.warn(`fd list failed for ${wsId}: ${(e as Error).message}`);
            return [];
          });

        // Only open / pending tickets, and only ones not yet drafted.
        const candidates = recentTickets.filter(
          (t) => OPEN_STATUSES.has(t.status) && !(t as { spam?: boolean }).spam,
        );

        if (candidates.length === 0) {
          await setLastAgentTick(wsId, new Date().toISOString());
          return { workspaceId: wsId, queued: 0, considered: 0 };
        }

        // Skip tickets that already have an agent_run (any status). v1
        // contract: one draft per ticket. Customer replies triggering a
        // re-draft come in v2.
        const ticketIds = candidates.map((t) => t.id);
        const { data: existingRuns } = await db()
          .from("agent_runs")
          .select("ticket_id")
          .eq("workspace_id", wsId)
          .in("ticket_id", ticketIds);
        const alreadyDrafted = new Set(
          (existingRuns ?? []).map((r) => r.ticket_id as number),
        );

        const toDraft = candidates
          .filter((t) => !alreadyDrafted.has(t.id))
          .slice(0, MAX_DRAFTS_PER_TICK);

        if (toDraft.length === 0) {
          await setLastAgentTick(wsId, new Date().toISOString());
          return {
            workspaceId: wsId,
            queued: 0,
            considered: candidates.length,
            note: "all open tickets already drafted",
          };
        }

        const ws = await getWorkspace(wsId);
        const apiKey = await loadWorkspaceApiKey(wsId);
        const allSkills = await listSkills(wsId);
        const stripeConn = await getWorkspaceStripe(wsId);

        let queued = 0;
        for (const ticket of toDraft) {
          const candidateSkills = selectCandidateSkills(ticket, allSkills, 20);

          const stripeContext = await maybeFetchStripeContext(
            ticket,
            stripeConn?.encryptedKey ?? null,
            decrypt,
          ).catch((e) => {
            logger.warn(`stripe ctx failed ticket ${ticket.id}: ${(e as Error).message}`);
            return null;
          });

          let draftResult;
          try {
            draftResult = await draftReply({
              workspace: ws,
              ticket,
              candidateSkills,
              stripeContext: stripeContext ?? undefined,
              apiKey,
            });
          } catch (e) {
            logger.warn(`draft failed ticket ${ticket.id}: ${(e as Error).message}`);
            continue;
          }

          const created = await createAgentRun({
            workspaceId: wsId,
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
          if (created) queued += 1;
        }

        await setLastAgentTick(wsId, new Date().toISOString());
        return {
          workspaceId: wsId,
          queued,
          considered: candidates.length,
          alreadyDrafted: alreadyDrafted.size,
        };
      });

      totalQueued += (result as { queued: number }).queued ?? 0;
    }

    return { totalQueued, workspaces: workspaces.length };
  },
);
