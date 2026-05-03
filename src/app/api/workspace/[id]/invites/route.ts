import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";
import { env } from "@/lib/env";

// Admin-only: list active invites for a workspace.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await db()
    .from("workspace_invites")
    .select("id, token, status, max_uses, uses_count, expires_at, created_at")
    .eq("workspace_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = env.appUrl;
  const invites = (data ?? []).map((inv) => ({
    ...inv,
    url: `${base}/invite/${inv.token}`,
  }));
  return NextResponse.json({ invites });
}

// Admin-only: create a new invite token. 32-char hex.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const token = randomBytes(16).toString("hex"); // 32 hex chars
  const { data, error } = await db()
    .from("workspace_invites")
    .insert({
      workspace_id: id,
      token,
      invited_by: user.id,
      status: "active",
      max_uses: 100,
    })
    .select("id, token, status, max_uses, uses_count, expires_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${env.appUrl}/invite/${data.token}`;
  return NextResponse.json({ invite: { ...data, url }, token: data.token, url });
}
