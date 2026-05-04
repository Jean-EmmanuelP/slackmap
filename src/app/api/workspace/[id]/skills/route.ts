import { NextRequest, NextResponse } from "next/server";
import { createSkill, updateSkill, deleteSkill } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin, userCanRead } from "@/lib/access";

const VALID_TYPES = new Set(["process", "policy", "decision", "escalation"]);
const VALID_DOMAINS = new Set(["engineering", "product", "support", "ops", "sales", "marketing", "leadership", "other"]);
const VALID_STATUSES = new Set(["draft", "active", "superseded"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// POST /api/workspace/[id]/skills — create a manual skill
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const canWrite = await userIsAdmin(workspaceId, user.id);
  if (!canWrite) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const type = (body?.type ?? "").toString();
  const title = (body?.title ?? "").toString().trim();
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "missing_title" }, { status: 400 });

  const domain = body?.domain && VALID_DOMAINS.has(body.domain) ? body.domain : null;
  const slug = body?.slug ? body.slug.toString().trim() : slugify(title);

  try {
    const skill = await createSkill(workspaceId, {
      type: type as "process" | "policy" | "decision" | "escalation",
      domain,
      slug,
      title,
      trigger: body?.trigger ? body.trigger.toString().trim() : null,
      steps_md: body?.steps_md ? body.steps_md.toString() : null,
      decision_criteria: body?.decision_criteria ? body.decision_criteria.toString() : null,
      escalation: body?.escalation ? body.escalation.toString() : null,
    });
    return NextResponse.json({ skill }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg.includes("23505")) return NextResponse.json({ error: "duplicate_slug" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/workspace/[id]/skills — update a skill by id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const canWrite = await userIsAdmin(workspaceId, user.id);
  if (!canWrite) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const skillId = (body?.id ?? "").toString();
  if (!skillId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body?.type && VALID_TYPES.has(body.type)) patch.type = body.type;
  if (body?.domain !== undefined) patch.domain = VALID_DOMAINS.has(body.domain) ? body.domain : null;
  if (typeof body?.slug === "string") patch.slug = body.slug.trim();
  if (typeof body?.title === "string") patch.title = body.title.trim();
  if (body?.trigger !== undefined) patch.trigger = body.trigger || null;
  if (body?.steps_md !== undefined) patch.steps_md = body.steps_md || null;
  if (body?.decision_criteria !== undefined) patch.decision_criteria = body.decision_criteria || null;
  if (body?.escalation !== undefined) patch.escalation = body.escalation || null;
  if (body?.status && VALID_STATUSES.has(body.status)) patch.status = body.status;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty_patch" }, { status: 400 });

  try {
    const skill = await updateSkill(workspaceId, skillId, patch as Parameters<typeof updateSkill>[2]);
    return NextResponse.json({ skill });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg.includes("23505")) return NextResponse.json({ error: "duplicate_slug" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/workspace/[id]/skills — delete a skill by id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const canDelete = await userIsAdmin(workspaceId, user.id);
  if (!canDelete) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const skillId = (body?.id ?? "").toString();
  if (!skillId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    await deleteSkill(workspaceId, skillId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "delete_failed" }, { status: 500 });
  }
}
