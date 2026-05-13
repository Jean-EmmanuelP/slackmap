import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { tickWorkspace } from "@/lib/agent/tick";

// Manual "Scan now" trigger from /freshdesk. Runs the tick SYNCHRONOUSLY
// (not via Inngest event) so the caller gets an immediate, useful summary
// in the response body. The hourly Inngest cron still handles the
// background automation; this route is the "do it now, tell me what
// happened" escape hatch.
//
// Timeout: drafts call the LLM, and we cap to 20 per tick — so worst case
// is ~20 × 3s ≈ 60s. Long but within Vercel's default function timeout.
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (user && !(await userCanRead(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await tickWorkspace(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
