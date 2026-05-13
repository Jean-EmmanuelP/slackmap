import { inngest } from "./client";
import { db } from "@/lib/db";
import { tickWorkspace } from "@/lib/agent/tick";

// Hourly cron + on-demand event listener. Both paths share the same logic
// via tickWorkspace (src/lib/agent/tick.ts) — the only difference is the
// trigger. For each workspace with Freshdesk connected, tickWorkspace:
//   - pulls 100 most-recently-updated tickets
//   - filters to open + non-spam, skips ones with an existing agent_run
//   - drafts up to MAX_DRAFTS_PER_TICK (20)
//   - persists drafts as pending agent_runs for human review
//
// Note: the manual "Scan now" button on /freshdesk does NOT go through
// Inngest anymore — it hits POST /api/workspace/[id]/agent/tick which
// calls tickWorkspace directly so the user gets an immediate response.
// Inngest stays as the scheduled/event-driven path.
export const agentTick = inngest.createFunction(
  {
    id: "agent-tick",
    triggers: [
      { cron: "0 * * * *" },
      { event: "agent/tick.manual" },
    ],
  },
  async ({ step, logger }) => {
    const { data: workspaces } = await db()
      .from("workspaces")
      .select("id")
      .not("freshdesk_domain", "is", null);
    if (!workspaces || workspaces.length === 0) return { skipped: "no workspaces" };

    let totalDrafted = 0;
    for (const w of workspaces) {
      const wsId = w.id as string;
      const result = await step.run(`tick-${wsId}`, async () => {
        try {
          return await tickWorkspace(wsId);
        } catch (e) {
          logger.warn(`tick failed for ${wsId}: ${(e as Error).message}`);
          return { workspaceId: wsId, drafted: 0, error: (e as Error).message };
        }
      });
      totalDrafted += (result as { drafted?: number }).drafted ?? 0;
    }

    return { totalDrafted, workspaces: workspaces.length };
  },
);
