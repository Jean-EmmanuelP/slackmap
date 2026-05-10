import { NextRequest, NextResponse } from "next/server";
import { listRecentFeedback } from "@/lib/db";

// Lists the most recent feedback events for a workspace — used by the
// dashboard to surface "Used 12x last week" badges and recent
// modification-proposed signals from agents.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const items = await listRecentFeedback(id, 50);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: "feedback_list_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
