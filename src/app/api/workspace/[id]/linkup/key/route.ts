import { NextRequest, NextResponse } from "next/server";
import { db, setWorkspaceLinkupKey } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { pingLinkup } from "@/lib/linkup";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await db()
    .from("workspaces")
    .select("linkup_key_set_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    keySet: !!data.linkup_key_set_at,
    keySetAt: data.linkup_key_set_at,
    platformFallback: !!process.env.LINKUP_API_KEY,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const apiKey = (body?.apiKey ?? "").toString().trim();
  if (!apiKey) {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  try {
    await pingLinkup(apiKey);
  } catch (e) {
    return NextResponse.json(
      { error: "linkup_auth_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  await setWorkspaceLinkupKey(id, encrypt(apiKey));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await setWorkspaceLinkupKey(id, null);
  return NextResponse.json({ ok: true });
}
