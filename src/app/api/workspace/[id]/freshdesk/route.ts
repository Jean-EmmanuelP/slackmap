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
    .select(
      "freshdesk_domain, freshdesk_connected_at, freshdesk_status, freshdesk_error, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Counts of skills/glossary derived from Freshdesk for this workspace.
  // We do this in parallel with a `count: 'exact', head: true` trick so we don't
  // ship rows back over the wire.
  const [skillsRes, glossaryRes, lastSkillRes] = await Promise.all([
    db()
      .from("skills")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("source", "freshdesk"),
    db()
      .from("glossary_entries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("source", "freshdesk"),
    db()
      .from("skills")
      .select("last_observed_at")
      .eq("workspace_id", id)
      .eq("source", "freshdesk")
      .order("last_observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const skillsCount = skillsRes.count ?? 0;
  const glossaryCount = glossaryRes.count ?? 0;
  // Prefer the timestamp of the most recent extracted skill; fall back to the
  // workspace's updated_at (covers the case where status moved to done but no
  // skills were extracted).
  const lastRunAt =
    (lastSkillRes.data?.last_observed_at as string | null | undefined) ??
    (data.freshdesk_status === "done" ? (data.updated_at as string | null) : null);

  return NextResponse.json({
    connected: !!data.freshdesk_domain,
    domain: data.freshdesk_domain,
    connectedAt: data.freshdesk_connected_at,
    status: data.freshdesk_status,
    error: data.freshdesk_error,
    lastRunAt,
    skillsCount,
    glossaryCount,
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
