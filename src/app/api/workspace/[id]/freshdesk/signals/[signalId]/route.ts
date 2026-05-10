import { NextRequest, NextResponse } from "next/server";
import { setFreshdeskSignalStatus, type FreshdeskSignal } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";

// POST /api/workspace/:id/freshdesk/signals/:signalId
// Body: { status: 'acknowledged' | 'resolved' | 'dismissed' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> },
) {
  const { id, signalId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status as FreshdeskSignal["status"] | undefined;
  if (!status || !["acknowledged", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json(
      { error: "invalid_status", detail: "status must be acknowledged | resolved | dismissed" },
      { status: 400 },
    );
  }

  const sessionUser = await getSessionUser();
  const userId = sessionUser?.id ?? null;

  try {
    await setFreshdeskSignalStatus(id, signalId, status, userId);
  } catch (e) {
    return NextResponse.json(
      { error: "update_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
