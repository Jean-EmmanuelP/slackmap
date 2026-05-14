// POST /api/workspace/[id]/agent/runs/[runId]/execute
//
// Body: { approvedActionIds: string[] }
//
// Phase 3 executor entry point. Admin-only. Runs the approved action IDs
// from the agent_run's proposed_actions in stage order, logs each to
// agent_action_log, persists applied_actions on the run.
//
// Safety: the executor allowlist (src/lib/agent/executor.ts) refuses any
// tool not explicitly enabled. Stripe write tools and Slack write tools
// are locked off in v1 — they show up in the UI but the executor returns
// status: "blocked" if approved.

import { NextRequest, NextResponse } from "next/server";
import { executeApprovedActions } from "@/lib/agent/executor";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id: workspaceId, runId } = await params;

  const user = await getSessionUser();
  if (!user || !(await userIsAdmin(workspaceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { approvedActionIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (
    !Array.isArray(body.approvedActionIds) ||
    !body.approvedActionIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: "approvedActionIds must be string[]" },
      { status: 400 },
    );
  }

  const { results, updatedRun } = await executeApprovedActions({
    runId,
    approvedActionIds: body.approvedActionIds as string[],
    executedBy: user.id,
  });

  return NextResponse.json({
    ok: true,
    results,
    run: updatedRun
      ? {
          id: updatedRun.id,
          status: updatedRun.status,
          applied_actions: updatedRun.applied_actions,
        }
      : null,
  });
}
