import { NextRequest, NextResponse } from "next/server";
import { db, setWorkspaceAnthropicKey } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await db()
    .from("workspaces")
    .select("anthropic_key_set_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ keySet: !!data.anthropic_key_set_at, setAt: data.anthropic_key_set_at });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const apiKey = (body?.apiKey ?? "").toString().trim();
  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "invalid_key_format" }, { status: 400 });
  }
  await setWorkspaceAnthropicKey(id, encrypt(apiKey));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await setWorkspaceAnthropicKey(id, null);
  return NextResponse.json({ ok: true });
}
