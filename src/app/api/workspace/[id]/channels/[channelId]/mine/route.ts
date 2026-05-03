import { NextRequest, NextResponse } from "next/server";
import { db, getChannel, setChannelMining } from "@/lib/db";
import { inngest } from "@/inngest/client";

// POST: enable mining for one channel + queue Inngest job.
// DELETE: disable mining (we keep already-extracted data in place; just stop refreshing).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;

  const ch = await getChannel(channelId);
  if (!ch || ch.workspace_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await setChannelMining(channelId, {
    mining_enabled: true,
    mining_status: "queued",
  });

  await inngest.send({
    name: "channel/mine.requested",
    data: { workspaceId: id, channelDbId: channelId },
  });

  return NextResponse.json({ ok: true, channelDbId: channelId, status: "queued" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;

  const ch = await getChannel(channelId);
  if (!ch || ch.workspace_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db()
    .from("channels")
    .update({ mining_enabled: false, mining_status: "idle", updated_at: new Date().toISOString() })
    .eq("id", channelId);

  return NextResponse.json({ ok: true });
}
