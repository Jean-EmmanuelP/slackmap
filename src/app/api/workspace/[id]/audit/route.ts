// POST /api/workspace/[id]/audit
//
// Body: { raw: string, label?: string }
//   raw = whatever the user pasted (URL + maybe a token, or DB conn string)
//
// Pipeline:
//   1. detectSource() — auto-detect kind from URL pattern
//   2. probeApi() — light probe of common paths if kind=api
//   3. Pull last 100 tickets summary from agent_runs
//   4. runAudit() — LLM produces the structured report
//   5. Persist data_source + audit_run + ranked customer_endpoints
//   6. Return the report

import { NextRequest, NextResponse } from "next/server";
import { db, getWorkspace } from "@/lib/db";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { detectSource, probeApi, runAudit } from "@/lib/runbook/audit";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin } from "@/lib/access";

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  const user = await getSessionUser();
  if (user && !(await userIsAdmin(workspaceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { raw?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const raw = body.raw?.trim();
  if (!raw || raw.length < 8) {
    return NextResponse.json({ error: "paste at least an API base URL" }, { status: 400 });
  }

  const detected = detectSource({ raw, label: body.label });

  // Persist the data source first so the audit_run can reference it
  const { data: dataSource } = await db()
    .from("data_sources")
    .insert({
      workspace_id: workspaceId,
      kind: detected.kind,
      label: body.label ?? `${detected.kind} source`,
      base_url: detected.base_url,
      metadata: {
        confidence: detected.confidence,
        detection_reasoning: detected.reasoning,
      },
      status: "scanning",
    })
    .select("id")
    .single();

  const dataSourceId = dataSource?.id ?? null;

  let probe: Awaited<ReturnType<typeof probeApi>> | undefined;
  if (detected.kind === "api") {
    probe = await probeApi(detected.base_url, detected.credential).catch(() => undefined);
  }

  // Summarise the workspace's tickets for the LLM prompt
  const { data: runs } = await db()
    .from("agent_runs")
    .select("ticket_subject, category, urgency, reasoning, matched_skill_slugs, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  const counts: Record<string, number> = {};
  for (const r of runs ?? []) {
    const cat = (r.category as string) ?? "other";
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  const totalTickets = (runs ?? []).length;
  const ticketSummaryLines = [
    `Total considered: ${totalTickets}`,
    `Distribution by category:`,
    ...Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `  - ${cat}: ${n} (${Math.round((n / Math.max(1, totalTickets)) * 100)}%)`),
    ``,
    `Sample of recent subjects + reasoning excerpts:`,
    ...(runs ?? [])
      .slice(0, 25)
      .map(
        (r) =>
          `  · "${(r.ticket_subject as string)?.slice(0, 80) ?? ""}" [${r.category ?? "other"}/${r.urgency ?? "?"}] — ${(r.reasoning as string)?.slice(0, 200) ?? ""}`,
      ),
  ];

  const workspace = await getWorkspace(workspaceId);
  const apiKey = await loadWorkspaceApiKey(workspaceId);

  let report;
  try {
    report = await runAudit({
      workspace,
      detected,
      probe,
      freshdeskTicketsSummary: ticketSummaryLines.join("\n"),
      apiKey,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (dataSourceId) {
      await db()
        .from("data_sources")
        .update({ status: "failed", last_scan_error: msg })
        .eq("id", dataSourceId);
    }
    return NextResponse.json(
      { ok: false, error: `audit failed: ${msg}` },
      { status: 500 },
    );
  }

  // Persist the audit_run + the proposed endpoints
  const { data: auditRun } = await db()
    .from("audit_runs")
    .insert({
      workspace_id: workspaceId,
      data_source_id: dataSourceId,
      report,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (auditRun?.id && Array.isArray(report.proposed_endpoints)) {
    const endpointRows = report.proposed_endpoints.map((e) => ({
      workspace_id: workspaceId,
      source_audit_run_id: auditRun.id as string,
      name: e.name,
      description: e.description,
      why: e.why,
      method: e.method,
      url_template: e.url_template,
      request_schema: e.request_schema ?? {},
      response_schema: e.response_schema ?? {},
      auth_hint: e.auth_hint ?? null,
      estimated_ticket_coverage: e.estimated_ticket_coverage ?? 0,
      estimated_ticket_coverage_pct: e.estimated_ticket_coverage_pct ?? 0,
      status: "proposed" as const,
    }));
    if (endpointRows.length > 0) {
      // upsert on (workspace_id, lower(name))
      await db()
        .from("customer_endpoints")
        .upsert(endpointRows, {
          onConflict: "workspace_id,name",
          ignoreDuplicates: false,
        });
    }
  }

  if (dataSourceId) {
    await db()
      .from("data_sources")
      .update({ status: "scanned", last_scan_at: new Date().toISOString() })
      .eq("id", dataSourceId);
  }

  return NextResponse.json({
    ok: true,
    auditRunId: auditRun?.id ?? null,
    detected,
    report,
  });
}
