import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

// GET /api/vaults/[id]/entries/[entryId]/reveal — single-shot decrypt. The
// client calls this only when the user clicks "Reveal" and discards the value
// after a few seconds. We intentionally keep this on a separate endpoint so
// listing a vault never returns plaintext, and so audit logging can hook here
// later without touching the main read path.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: vaultId, entryId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await userCanAccessVault(vaultId, user.id);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await db()
    .from("vault_entries")
    .select("encrypted_secret")
    .eq("id", entryId)
    .eq("vault_id", vaultId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ct = data.encrypted_secret as string | null;
  if (!ct) return NextResponse.json({ secret: null });

  try {
    const secret = decrypt(ct);
    // Belt-and-braces: never cache. Treat it like a one-time response.
    return new NextResponse(JSON.stringify({ secret }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, private",
        pragma: "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }
}
