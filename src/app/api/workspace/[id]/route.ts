import { NextRequest, NextResponse } from "next/server";
import { db, listChannels, listGlossary } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: ws, error } = await db()
    .from("workspaces")
    .select(
      "id, slack_team_name, slack_team_domain, backfill_status, backfill_progress, backfill_total, last_event_received_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [channels, glossary] = await Promise.all([listChannels(id), listGlossary(id)]);
  return NextResponse.json({ workspace: ws, channels, glossary });
}
