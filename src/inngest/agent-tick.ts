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

// Cron: every 15 minutes, walk every workspace with Freshdesk connected, pull
// the new tickets since last tick, draft a reply via the agent runtime, and
// queue it as a `pending` agent_run for human review on /agent.
//
// Idempotent thanks to the unique (workspace_id, ticket_id) constraint on
// agent_runs — re-running on the same ticket is a no-op.
export const agentTick = inngest.createFunction(
  {
    id: "agent-tick",
    // Every hour on the hour. Support inbox doesn't need 15-min polling —
    // Marc reviews drafts 2-3x per day. Hourly keeps the customer-wait-time
    // under 1h while avoiding cron noise.
    //
    // Also listens on `agent/tick.manual` so the "Scan now" button on
    // /freshdesk can force an immediate tick without waiting for the cron.
    triggers: [
      { cron: "0 * * * *" },
      { event: "agent/tick.manual" },
    ],
  },
  async ({ step, logger }) => {
    const { data: workspaces } = await db()
      .from("workspaces")
      .select("id, freshdesk_domain, last_agent_tick_at")
      .not("freshdesk_domain", "is", null);
    if (!workspaces || workspaces.length === 0) return { skipped: "no workspaces" };

    let totalQueued = 0;
    for (const w of workspaces) {
      const wsId = w.id as string;
      const result = await step.run(`tick-${wsId}`, async () => {
        const conn = await getWorkspaceFreshdesk(wsId);
        if (!conn) return { workspaceId: wsId, queued: 0, skipped: "no freshdesk" };

        const fd = new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));
        const since =
          (w.last_agent_tick_at as string | null) ??
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const newTickets = await fd
          .listTicketsUpdatedSince(since, { perPage: 50, pages: 2 })
          .catch((e) => {
            logger.warn(`fd list failed for ${wsId}: ${(e as Error).message}`);
            return [];
          });

        if (newTickets.length === 0) {
          await setLastAgentTick(wsId, new Date().toISOString());
          return { workspaceId: wsId, queued: 0, considered: 0 };
        }

        const ws = await getWorkspace(wsId);
        const apiKey = await loadWorkspaceApiKey(wsId);
        const allSkills = await listSkills(wsId);
        // Stripe connection (optional). When present, billing tickets get a
        // customer snapshot pre-fetched and injected into the draft prompt.
        const stripeConn = await getWorkspaceStripe(wsId);

        let queued = 0;
        for (const ticket of newTickets) {
          // Only drafted on customer-incoming tickets — skip outbound notifications,
          // already-closed tickets, and our own internal noise.
          if (ticket.status === 5) continue; // closed
          if ((ticket as { spam?: boolean }).spam) continue;

          const candidateSkills = selectCandidateSkills(ticket, allSkills, 20);

          // Pre-fetch Stripe context if the ticket smells like billing AND Stripe
          // is connected. Returns null cheaply when not applicable; never throws.
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
        return { workspaceId: wsId, queued, considered: newTickets.length };
      });

      totalQueued += (result as { queued: number }).queued ?? 0;
    }

    return { totalQueued, workspaces: workspaces.length };
  },
);
