import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCanRead, userIsAdmin } from "@/lib/access";
import { getSessionUser } from "@/lib/supabase-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await userCanRead(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // workspace_members has no auth.users join exposed via PostgREST without a
  // foreign-key relationship; we fetch IDs first then resolve emails via the
  // service-role auth.admin API.
  const { data: rows, error } = await db()
    .from("workspace_members")
    .select("user_id, role, created_at, invited_by")
    .eq("workspace_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members: Array<{
    user_id: string;
    role: string;
    created_at: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
  }> = [];
  for (const r of rows ?? []) {
    let email: string | null = null;
    let name: string | null = null;
    let avatar: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: u } = await (db().auth as any).admin.getUserById(r.user_id);
      const meta = (u?.user?.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };
      email = u?.user?.email ?? null;
      name = meta.full_name ?? meta.name ?? null;
      avatar = meta.avatar_url ?? meta.picture ?? null;
    } catch {
      // If the admin API isn't usable in this env, fall back to ID-only.
    }
    members.push({
      user_id: r.user_id as string,
      role: r.role as string,
      created_at: r.created_at as string,
      email,
      name,
      avatar_url: avatar,
    });
  }

  return NextResponse.json({ members, isAdmin: await userIsAdmin(id, user.id) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await userIsAdmin(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "missing_userId" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: "cant_remove_self_use_leave" },
      { status: 400 },
    );
  }
  const { error } = await db()
    .from("workspace_members")
    .delete()
    .eq("workspace_id", id)
    .eq("user_id", targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
