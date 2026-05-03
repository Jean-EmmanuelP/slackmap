import { NextRequest, NextResponse } from "next/server";
import { db, setWorkspaceFreshdesk } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { inngest } from "@/inngest/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await db()
    .from("workspaces")
    .select("freshdesk_domain, freshdesk_connected_at, freshdesk_status, freshdesk_error")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    connected: !!data.freshdesk_domain,
    domain: data.freshdesk_domain,
    connectedAt: data.freshdesk_connected_at,
    status: data.freshdesk_status,
    error: data.freshdesk_error,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const domain = (body?.domain ?? "").toString().trim();
  const apiKey = (body?.apiKey ?? "").toString().trim();
  if (!domain || !apiKey) {
    return NextResponse.json({ error: "missing_domain_or_key" }, { status: 400 });
  }

  // Verify the credentials before saving — fail fast if domain/key wrong.
  const fd = new FreshdeskClient(domain, apiKey);
  try {
    await fd.ping();
  } catch (e) {
    return NextResponse.json(
      { error: "freshdesk_auth_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  await setWorkspaceFreshdesk(id, {
    domain: fd.host,
    encryptedKey: encrypt(apiKey),
  });

  await inngest.send({
    name: "workspace/freshdesk.requested",
    data: { workspaceId: id },
  });

  return NextResponse.json({ ok: true, domain: fd.host, status: "queued" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await setWorkspaceFreshdesk(id, null);
  return NextResponse.json({ ok: true });
}
