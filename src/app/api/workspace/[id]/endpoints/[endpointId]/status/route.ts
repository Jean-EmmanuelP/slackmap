// POST /api/workspace/[id]/endpoints/[endpointId]/status
//
// Transition a proposed customer endpoint through its lifecycle:
//   proposed → implemented  (dev has built it, not yet plugged in)
//   implemented → active    (live URL + auth provided, agent can call it)
//   active → deprecated     (removed from production)
//   any → proposed          (restore — useful if accidentally archived)
//
// Body shape:
//   { status: 'implemented' | 'active' | 'deprecated' | 'proposed',
//     live_base_url?: string,   // required when activating
//     auth_token?: string       // optional bearer to call the endpoint
//   }
//
// Admin-gated. The auth_token, when provided, is stored encrypted via the
// existing crypto helpers so even DB reads can't leak it.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";

const ALLOWED_STATUSES = new Set(["proposed", "implemented", "active", "deprecated"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; endpointId: string }> },
) {
  const { id: workspaceId, endpointId } = await params;

  const user = await getSessionUser();
  if (!user || !(await userIsAdmin(workspaceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    status?: string;
    live_base_url?: string;
    auth_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}` },
      { status: 400 },
    );
  }

  // For activation we require a live URL — otherwise the agent has nowhere
  // to call. The auth token is optional (some internal endpoints are
  // unauthenticated when running on the same VPC).
  if (body.status === "active") {
    if (!body.live_base_url || !body.live_base_url.startsWith("http")) {
      return NextResponse.json(
        { error: "live_base_url required (https://...) when activating" },
        { status: 400 },
      );
    }
  }

  // Fetch the endpoint first to verify it belongs to this workspace
  const { data: existing, error: fetchError } = await db()
    .from("customer_endpoints")
    .select("id, workspace_id, status")
    .eq("id", endpointId)
    .maybeSingle();
  if (fetchError || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Build update payload — only set fields that the transition needs
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: body.status };

  if (body.status === "implemented") {
    update.marked_implemented_at = now;
  } else if (body.status === "active") {
    update.marked_active_at = now;
    update.live_base_url = body.live_base_url;
    if (body.auth_token && body.auth_token.length > 0) {
      update.encrypted_auth_token = encrypt(body.auth_token);
    }
  }

  const { error: updateError } = await db()
    .from("customer_endpoints")
    .update(update)
    .eq("id", endpointId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: body.status });
}
