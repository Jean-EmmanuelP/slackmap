import { NextRequest, NextResponse } from "next/server";
import { db, listMinableChannels, setChannelMining } from "@/lib/db";
import { inngest } from "@/inngest/client";

// Bulk: enqueue mining for every public channel that's not yet enabled.
// Private channels are skipped — they require a human invite first.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: ws } = await db().from("workspaces").select("id").eq("id", id).maybeSingle();
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const channels = await listMinableChannels(id, false); // public only
  const queued: string[] = [];

  for (const ch of channels) {
    await setChannelMining(ch.id, { mining_enabled: true, mining_status: "queued" });
    await inngest.send({
      name: "channel/mine.requested",
      data: { workspaceId: id, channelDbId: ch.id },
    });
    queued.push(ch.name);
  }

  return NextResponse.json({ ok: true, queuedCount: queued.length, channels: queued });
}
