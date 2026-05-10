import { NextRequest, NextResponse } from "next/server";
import { db, getAgentRun, getWorkspaceFreshdesk, markAgentRunSent } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { getSessionUser } from "@/lib/supabase-server";

// Levenshtein distance — normalised 0..1 over the longer string. Small enough
// that we don't pull a dependency for it.
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return 1;
  const m = a.length;
  const n = b.length;
  const prev: number[] = new Array(n + 1);
  const cur: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n] / Math.max(m, n);
}

// POST body: { draft: string }   ← what the human is actually sending
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id, runId } = await params;
  const body = await req.json().catch(() => ({}));
  const draft = (body?.draft ?? "").toString().trim();
  if (!draft) return NextResponse.json({ error: "empty_draft" }, { status: 400 });

  const run = await getAgentRun(runId);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.workspace_id !== id) return NextResponse.json({ error: "wrong_workspace" }, { status: 400 });
  if (run.status !== "pending") {
    return NextResponse.json({ error: "already_processed", status: run.status }, { status: 409 });
  }

  // Send via Freshdesk
  const conn = await getWorkspaceFreshdesk(id);
  if (!conn) return NextResponse.json({ error: "freshdesk_not_connected" }, { status: 412 });
  try {
    const fd = new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));
    await fd.postPublicReply(run.ticket_id, draft);
  } catch (e) {
    // Persist failure on the run — surface in /agent so the human can retry
    await db()
      .from("agent_runs")
      .update({ status: "failed", outcome: "failed", rejection_reason: (e as Error).message })
      .eq("id", runId);
    return NextResponse.json({ error: "freshdesk_send_failed", detail: (e as Error).message }, { status: 502 });
  }

  // Compute diff between AI draft and what the human actually sent.
  const diff = run.draft_original ? lev(run.draft_original, draft) : 1;
  const session = await getSessionUser();
  await markAgentRunSent(runId, draft, diff, session?.id ?? null);

  return NextResponse.json({ ok: true, diff_distance: diff });
}
