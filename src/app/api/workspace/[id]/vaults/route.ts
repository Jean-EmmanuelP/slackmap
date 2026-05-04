import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead, userIsAdmin } from "@/lib/access";

// GET /api/workspace/[id]/vaults — list vaults the current user can see.
// 'team' vaults visible to any workspace member; 'private' only if the user
// has a vault_access grant or is workspace admin.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const canRead = await userCanRead(workspaceId, user.id);
  if (!canRead) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const isAdmin = await userIsAdmin(workspaceId, user.id);

  const { data: vaults, error } = await db()
    .from("vaults")
    .select("id, workspace_id, name, description, category, visibility, created_by, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("category")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter private vaults the user has no grant to (admins see everything).
  const allVaults = (vaults ?? []) as Array<{
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    category: string | null;
    visibility: "team" | "private";
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const privateIds = allVaults.filter((v) => v.visibility === "private").map((v) => v.id);
  let grantedSet = new Set<string>();
  if (privateIds.length > 0 && !isAdmin) {
    const { data: grants } = await db()
      .from("vault_access")
      .select("vault_id")
      .in("vault_id", privateIds)
      .eq("user_id", user.id);
    grantedSet = new Set((grants ?? []).map((g) => g.vault_id as string));
  }

  const visible = allVaults.filter(
    (v) => v.visibility === "team" || isAdmin || grantedSet.has(v.id),
  );

  // Add entry counts in a single query.
  const ids = visible.map((v) => v.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: entries } = await db()
      .from("vault_entries")
      .select("vault_id")
      .in("vault_id", ids);
    for (const row of entries ?? []) {
      const vid = row.vault_id as string;
      counts[vid] = (counts[vid] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    vaults: visible.map((v) => ({ ...v, entry_count: counts[v.id] ?? 0 })),
    isAdmin,
  });
}

// POST /api/workspace/[id]/vaults — admin creates a new vault.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const isAdmin = await userIsAdmin(workspaceId, user.id);
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  const description = body?.description ? body.description.toString().trim() : null;
  const visibility = body?.visibility === "private" ? "private" : "team";
  const category = body?.category ? body.category.toString().trim() : null;

  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const { data, error } = await db()
    .from("vaults")
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      category,
      visibility,
      created_by: user.id,
    })
    .select("id, workspace_id, name, description, category, visibility, created_at, updated_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_name" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For private vaults: auto-grant the creator admin access on the vault.
  if (visibility === "private") {
    await db()
      .from("vault_access")
      .upsert(
        { vault_id: data.id, user_id: user.id, role: "admin", granted_by: user.id },
        { onConflict: "vault_id,user_id" },
      );
  }

  return NextResponse.json({ vault: data });
}
