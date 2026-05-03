import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lightweight polling endpoint: counts of channels per mining_status, plus
// glossary / skills / people totals. Atlas polls this every 2-3s during a
// mining run to show live progress without reloading the whole page.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [{ data: chans }, glossaryHead, skillsHead, peopleHead] = await Promise.all([
    db()
      .from("channels")
      .select("mining_status, message_count_6mo, purpose_extracted")
      .eq("workspace_id", id),
    db().from("glossary_entries").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    db().from("skills").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    db().from("people").select("*", { count: "exact", head: true }).eq("workspace_id", id).eq("is_bot", false),
  ]);

  const counts = { idle: 0, queued: 0, running: 0, done: 0, failed: 0 };
  let withPurpose = 0;
  for (const c of chans ?? []) {
    const s = (c.mining_status as keyof typeof counts) ?? "idle";
    if (counts[s] !== undefined) counts[s] += 1;
    if (c.purpose_extracted) withPurpose += 1;
  }
  const total = (chans ?? []).length;
  const inProgress = counts.queued + counts.running;

  return NextResponse.json({
    channels: { total, ...counts, with_purpose: withPurpose },
    glossary: glossaryHead.count ?? 0,
    skills: skillsHead.count ?? 0,
    people: peopleHead.count ?? 0,
    inProgress,
    isActive: inProgress > 0,
  });
}
