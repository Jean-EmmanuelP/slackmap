import { NextRequest, NextResponse } from "next/server";
import { db, getSkill } from "@/lib/db";
import { renderSkillMarkdown } from "@/lib/extract/skills";

// Returns a single skill as Claude-skill-compatible markdown.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const { id, slug } = await params;

  const { data: ws } = await db()
    .from("workspaces")
    .select("id, slack_team_domain")
    .eq("id", id)
    .maybeSingle();
  if (!ws) return new NextResponse("not found", { status: 404 });

  const skill = await getSkill(id, slug);
  if (!skill) return new NextResponse("not found", { status: 404 });

  const md = renderSkillMarkdown({
    slug: skill.slug,
    title: skill.title,
    type: skill.type,
    trigger: skill.trigger,
    steps_md: skill.steps_md,
    decision_criteria: skill.decision_criteria,
    escalation: skill.escalation,
    citations: skill.citations,
    confidence: skill.confidence,
    source_count: skill.source_count,
    last_observed_at: skill.last_observed_at,
    workspace_team_domain: (ws.slack_team_domain as string | null) ?? null,
  });

  return new NextResponse(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="${skill.slug}.md"`,
    },
  });
}
