import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

// Manual trigger of the agent tick — useful for testing / on-demand "scan now"
// from the /agent UI without waiting for the cron.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params; // workspace id reserved for future per-workspace event payload
  await inngest.send({ name: "agent/tick.manual", data: {} });
  return NextResponse.json({ ok: true, queued: true });
}
