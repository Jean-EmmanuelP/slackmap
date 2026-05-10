import { NextRequest, NextResponse } from "next/server";
import { recordSkillFeedback } from "@/lib/db";

// POST body: { applied?: boolean, rating?: 1..5, modificationProposed?: string,
//              context?: string, source?: 'agent' | 'cli' | 'manual' }
//
// Closes the brain ⇄ agent loop: when an installed skill is used by a Claude
// agent (or a human reviewer), we record the signal so we can refine
// confidence and surface "still valid?" prompts on the dashboard.
//
// Authentication: this endpoint accepts the workspace ID in the URL path —
// matching the existing skills download endpoint pattern. A future hardening
// pass should add a workspace-scoped token (HMAC or signed JWT).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const { id, slug } = await params;
  const body = await req.json().catch(() => ({}));

  const applied = body.applied === undefined ? true : Boolean(body.applied);
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null;
  const modificationProposed =
    typeof body.modificationProposed === "string" && body.modificationProposed.trim().length > 0
      ? body.modificationProposed.trim().slice(0, 4000)
      : null;
  const context =
    typeof body.context === "string" && body.context.trim().length > 0
      ? body.context.trim().slice(0, 500)
      : null;
  const source =
    body.source === "cli" || body.source === "manual" || body.source === "agent"
      ? body.source
      : "agent";

  let result;
  try {
    result = await recordSkillFeedback({
      workspaceId: id,
      skillSlug: slug,
      applied,
      rating,
      modificationProposed,
      context,
      source,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "feedback_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }

  if (!result) {
    return NextResponse.json({ error: "skill_not_found", slug }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    feedbackId: result.feedbackId,
    skillId: result.skillId,
    appliedCount: result.appliedCount,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      hint:
        "POST to this endpoint with { applied, rating?, modificationProposed?, context?, source? } " +
        "to record skill feedback. Used by the Claude Code skill bundle to close the brain ⇄ agent loop.",
    },
    { status: 405 },
  );
}
