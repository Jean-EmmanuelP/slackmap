import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

// POST /api/vaults/[id]/import-env — parse a .env file (as text) and create
// one vault entry per KEY=VALUE line. Lines starting with # are ignored.
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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const envText = (body?.content ?? "").toString();
  const prefix = (body?.prefix ?? "").toString().trim();
  if (!envText.trim()) {
    return NextResponse.json({ error: "empty_content" }, { status: 400 });
  }

  const lines = envText.split("\n");
  const entries: Array<{ key: string; value: string }> = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) entries.push({ key, value });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "no_valid_lines" }, { status: 400 });
  }

  const rows = entries.map((e) => ({
    vault_id: vaultId,
    workspace_id: access.vault!.workspace_id,
    kind: "env_file" as const,
    label: prefix ? `${prefix}${e.key}` : e.key,
    encrypted_secret: encrypt(e.value),
    notes: null,
    username: null,
    url: null,
    metadata: {},
    created_by: user.id,
  }));

  const { data, error } = await db()
    .from("vault_entries")
    .insert(rows)
    .select("id, kind, label, created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: (data ?? []).length, entries: data });
}
