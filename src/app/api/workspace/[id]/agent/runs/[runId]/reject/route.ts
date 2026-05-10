import { NextRequest, NextResponse } from "next/server";
import { getAgentRun, markAgentRunRejected } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id, runId } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

  const run = await getAgentRun(runId);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.workspace_id !== id) return NextResponse.json({ error: "wrong_workspace" }, { status: 400 });
  if (run.status !== "pending") {
    return NextResponse.json({ error: "already_processed", status: run.status }, { status: 409 });
  }

  const session = await getSessionUser();
  await markAgentRunRejected(runId, reason, session?.id ?? null);
  return NextResponse.json({ ok: true });
}
