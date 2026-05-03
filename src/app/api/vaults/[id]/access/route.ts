import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

type AccessRow = {
  vault_id: string;
  user_id: string;
  role: "read" | "write" | "admin";
  granted_by: string | null;
  created_at: string;
};

// GET /api/vaults/[id]/access — list grants. Workspace admin OR vault admin.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vaultId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok || !access.vault)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!access.isWorkspaceAdmin && access.vaultRole !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: grants, error } = await db()
    .from("vault_access")
    .select("vault_id, user_id, role, granted_by, created_at")
    .eq("vault_id", vaultId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (grants ?? []) as AccessRow[];

  // Fetch member display names for the workspace so the UI can render people
  // by name + email instead of raw UUIDs.
  const { data: members } = await db()
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", access.vault.workspace_id);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const ids = Array.from(new Set([...memberIds, ...rows.map((r) => r.user_id)]));

  // Read user metadata via auth schema. The service-role client can read this.
  const profiles: Record<string, { email: string | null; name: string | null }> = {};
  for (const uid of ids) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: u } = await (db().auth as any).admin.getUserById(uid);
    if (u?.user) {
      profiles[uid] = {
        email: u.user.email ?? null,
        name: (u.user.user_metadata?.name as string | undefined) ?? null,
      };
    } else {
      profiles[uid] = { email: null, name: null };
    }
  }

  return NextResponse.json({
    grants: rows.map((r) => ({ ...r, profile: profiles[r.user_id] ?? null })),
    members: (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      role: m.role as string,
      profile: profiles[m.user_id as string] ?? null,
    })),
  });
}

// POST /api/vaults/[id]/access — grant a member access.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vaultId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok || !access.vault)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!access.isWorkspaceAdmin && access.vaultRole !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const targetUserId = (body?.user_id ?? "").toString().trim();
  const role = body?.role === "write" || body?.role === "admin" ? body.role : "read";
  if (!targetUserId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  // Sanity: the target user must already be a workspace member.
  const { data: m } = await db()
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", access.vault.workspace_id)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: "not_a_member" }, { status: 400 });

  const { error } = await db()
    .from("vault_access")
    .upsert(
      {
        vault_id: vaultId,
        user_id: targetUserId,
        role,
        granted_by: user.id,
      },
      { onConflict: "vault_id,user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
