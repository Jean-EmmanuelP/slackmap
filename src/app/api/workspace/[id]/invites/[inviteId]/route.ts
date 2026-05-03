import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";

// Admin-only: revoke an invite (sets status='revoked'). Idempotent.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const { id, inviteId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await db()
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("workspace_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
