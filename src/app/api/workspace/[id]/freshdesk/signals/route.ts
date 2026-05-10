import { NextRequest, NextResponse } from "next/server";
import { listFreshdeskSignals, type FreshdeskSignal } from "@/lib/db";

// GET /api/workspace/:id/freshdesk/signals?status=new,acknowledged
// Defaults to ['new'] so the dashboard's "needs attention" surface stays clean.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10)));

  const status = statusParam
    ? (statusParam.split(",").map((s) => s.trim()).filter(Boolean) as FreshdeskSignal["status"][])
    : (["new"] as FreshdeskSignal["status"][]);
  const sinceDaysRaw = url.searchParams.get("sinceDays");
  const sinceDays = sinceDaysRaw ? Math.max(1, parseInt(sinceDaysRaw, 10)) : undefined;

  try {
    const items = await listFreshdeskSignals(id, { status, limit, sinceDays });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: "signals_list_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
