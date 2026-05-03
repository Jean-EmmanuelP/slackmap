import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

// Re-extract a single person's profile. Optionally pass a `hint` in the body
// (string) — the user can correct the LLM with text like "He's actually a
// designer, not an engineer" and the next extraction will use it as guidance.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const body = await req.json().catch(() => ({}));
  const hint: string | undefined = body?.hint;

  const { data: person } = await db()
    .from("people")
    .select("id, slack_user_id, workspace_id")
    .eq("id", personId)
    .maybeSingle();
  if (!person || person.workspace_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await inngest.send({
    name: "person/re-extract.requested",
    data: { workspaceId: id, slackUserId: person.slack_user_id, hint: hint ?? null },
  });

  return NextResponse.json({ ok: true, queued: true });
}
