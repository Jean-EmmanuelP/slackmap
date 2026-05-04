import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

const ALLOWED_KINDS = new Set(["password", "account", "api_key", "url", "note", "env_file", "other"]);

// POST /api/vaults/[id]/entries — add an entry. The optional `secret` field
// is encrypted server-side before it touches the DB. We return a sanitised
// row with `has_secret` and never echo the plaintext back.
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
  if (!access.isWorkspaceAdmin && access.vaultRole !== "write" && access.vaultRole !== "admin") {
    // For team-visibility vaults, any workspace member can read but writing
    // still requires either workspace-admin or an explicit write/admin grant.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const kind = (body?.kind ?? "").toString();
  const label = (body?.label ?? "").toString().trim();
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!label) return NextResponse.json({ error: "missing_label" }, { status: 400 });

  const username = body?.username ? body.username.toString().trim() : null;
  const url = body?.url ? body.url.toString().trim() : null;
  const notes = body?.notes ? body.notes.toString() : null;
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const secretRaw = typeof body?.secret === "string" ? body.secret : null;
  const encrypted_secret = secretRaw ? encrypt(secretRaw) : null;

  const { data, error } = await db()
    .from("vault_entries")
    .insert({
      vault_id: vaultId,
      workspace_id: access.vault.workspace_id,
      kind,
      label,
      username,
      url,
      encrypted_secret,
      notes,
      metadata,
      created_by: user.id,
    })
    .select(
      "id, vault_id, workspace_id, kind, label, username, url, notes, metadata, created_by, created_at, updated_at",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entry: { ...data, has_secret: !!encrypted_secret } });
}
