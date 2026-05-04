import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

const ALLOWED_KINDS = new Set(["password", "account", "api_key", "url", "note", "env_file", "other"]);

// PATCH /api/vaults/[id]/entries/[entryId] — update fields. Re-encrypt secret
// only if the client sent one. Pass empty string `""` to explicitly clear.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: vaultId, entryId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok || !access.vault)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!access.isWorkspaceAdmin && access.vaultRole !== "write" && access.vaultRole !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.label === "string") patch.label = body.label.trim();
  if (typeof body?.kind === "string") {
    if (!ALLOWED_KINDS.has(body.kind))
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    patch.kind = body.kind;
  }
  if (body?.username !== undefined) patch.username = body.username || null;
  if (body?.url !== undefined) patch.url = body.url || null;
  if (body?.notes !== undefined) patch.notes = body.notes || null;
  if (body?.metadata && typeof body.metadata === "object") patch.metadata = body.metadata;
  if (body?.secret !== undefined) {
    const s = typeof body.secret === "string" ? body.secret : "";
    patch.encrypted_secret = s.length > 0 ? encrypt(s) : null;
  }

  const { data, error } = await db()
    .from("vault_entries")
    .update(patch)
    .eq("id", entryId)
    .eq("vault_id", vaultId)
    .select(
      "id, vault_id, workspace_id, kind, label, username, url, notes, metadata, encrypted_secret, created_at, updated_at",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip ciphertext before returning.
  const { encrypted_secret, ...rest } = data as { encrypted_secret: string | null } & Record<string, unknown>;
  return NextResponse.json({ entry: { ...rest, has_secret: !!encrypted_secret } });
}

// DELETE /api/vaults/[id]/entries/[entryId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: vaultId, entryId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok || !access.vault)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!access.isWorkspaceAdmin && access.vaultRole !== "write" && access.vaultRole !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await db()
    .from("vault_entries")
    .delete()
    .eq("id", entryId)
    .eq("vault_id", vaultId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
