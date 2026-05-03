import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault, userIsAdmin } from "@/lib/access";

type EntryRow = {
  id: string;
  vault_id: string;
  workspace_id: string;
  kind: "password" | "account" | "api_key" | "url" | "note" | "other";
  label: string;
  username: string | null;
  url: string | null;
  encrypted_secret: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// GET /api/vaults/[id] — vault metadata + entries (secrets stay encrypted; the
// client must call /reveal to decrypt one entry at a time). We return a
// has_secret boolean instead of the ciphertext so secrets never leak via
// list responses or browser caches.
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

  const { data: vault } = await db()
    .from("vaults")
    .select("id, workspace_id, name, description, visibility, created_by, created_at, updated_at")
    .eq("id", vaultId)
    .single();

  const { data: entries } = await db()
    .from("vault_entries")
    .select(
      "id, vault_id, workspace_id, kind, label, username, url, encrypted_secret, notes, metadata, created_by, created_at, updated_at",
    )
    .eq("vault_id", vaultId)
    .order("created_at", { ascending: false });

  const sanitised = ((entries ?? []) as EntryRow[]).map((e) => {
    // Strip the ciphertext from the list response — the client gets a flag and
    // explicitly hits /reveal when the user clicks the eye.
    const { encrypted_secret: _omit, ...rest } = e;
    return { ...rest, has_secret: !!e.encrypted_secret };
  });

  return NextResponse.json({
    vault,
    entries: sanitised,
    canWrite: access.isWorkspaceAdmin || access.vaultRole === "write" || access.vaultRole === "admin",
    canManage: access.isWorkspaceAdmin || access.vaultRole === "admin",
  });
}

// PATCH /api/vaults/[id] — rename / change description / visibility (admin).
export async function PATCH(
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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.description === "string") patch.description = body.description.trim();
  if (body?.visibility === "team" || body?.visibility === "private") patch.visibility = body.visibility;

  const { data, error } = await db()
    .from("vaults")
    .update(patch)
    .eq("id", vaultId)
    .select("id, workspace_id, name, description, visibility, updated_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_name" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ vault: data });
}

// DELETE /api/vaults/[id] — workspace admin only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vaultId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok || !access.vault)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!access.isWorkspaceAdmin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Belt-and-braces — re-check with workspace.
  const wsAdmin = await userIsAdmin(access.vault.workspace_id, user.id);
  if (!wsAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await db().from("vaults").delete().eq("id", vaultId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
