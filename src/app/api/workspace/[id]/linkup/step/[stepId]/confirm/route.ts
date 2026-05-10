import { NextRequest, NextResponse } from "next/server";
import { db, persistCompanyStep } from "@/lib/db";
import { getWizardStep, type WizardWorkspaceState } from "@/lib/linkup/wizard-steps";

// POST /api/workspace/:id/linkup/step/:stepId/confirm
// Body: { confirmed: <step-specific value>, proposed?: <linkup raw>, sources?: [...] }
// Persists the user-validated value into the right column(s) and stashes the
// raw Linkup payload + sources into company_context.steps[stepId].
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { id, stepId } = await params;
  const step = getWizardStep(stepId);
  if (!step) return NextResponse.json({ error: "unknown_step" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const confirmed = body?.confirmed;
  if (confirmed === undefined || confirmed === null) {
    return NextResponse.json({ error: "missing_confirmed" }, { status: 400 });
  }

  const { data: ws, error: wsError } = await db()
    .from("workspaces")
    .select(
      "slack_team_name, slack_team_domain, company_name, company_website, company_scope, company_country",
    )
    .eq("id", id)
    .maybeSingle();
  if (wsError) {
    return NextResponse.json(
      { error: "workspace_query_failed", detail: wsError.message },
      { status: 500 },
    );
  }
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const wsState: WizardWorkspaceState = {
    slack_team_name: (ws.slack_team_name as string | null) ?? null,
    slack_team_domain: (ws.slack_team_domain as string | null) ?? null,
    company_name: (ws.company_name as string | null) ?? null,
    company_website: (ws.company_website as string | null) ?? null,
    company_scope: (ws.company_scope as "worldwide" | "national" | null) ?? null,
    company_country: (ws.company_country as string | null) ?? null,
  };

  const columnPatch = step.persist(confirmed, wsState);
  await persistCompanyStep(id, stepId, columnPatch, {
    proposed: body?.proposed ?? null,
    confirmed,
    sources: body?.sources ?? [],
  });

  return NextResponse.json({ ok: true, patch: columnPatch });
}
