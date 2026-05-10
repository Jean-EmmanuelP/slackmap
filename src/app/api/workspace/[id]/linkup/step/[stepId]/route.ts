import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWizardStep, type WizardWorkspaceState } from "@/lib/linkup/wizard-steps";
import { linkupClient, linkupStructured, linkupFastAnswer, loadWorkspaceLinkupKey, type LinkupSource } from "@/lib/linkup";
import { regionHintFromWorkspace } from "@/lib/linkup/region";
import { deriveAudienceFromSources } from "@/lib/linkup/derived-audience";
import { deriveDescriptionFromSources } from "@/lib/linkup/derived-description";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

// POST /api/workspace/:id/linkup/step/:stepId
// Runs the Linkup search for the given wizard step using the latest workspace
// state and returns { data, sources } for the UI to render. The API key never
// leaves the server. Manual steps (kind='manual') skip Linkup and return early
// so the wizard can render its custom UI.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { id, stepId } = await params;
  const step = getWizardStep(stepId);
  if (!step) {
    return NextResponse.json({ error: "unknown_step" }, { status: 400 });
  }

  // Manual steps don't talk to Linkup. The wizard shouldn't even POST here for
  // them, but answer cleanly if it does.
  if (step.kind === "manual" || !step.query || !step.schema) {
    return NextResponse.json({ data: null, sources: [], manual: true });
  }

  const { data: ws, error: wsError } = await db()
    .from("workspaces")
    .select(
      "slack_team_name, slack_team_domain, company_name, company_website, company_scope, company_country, company_context",
    )
    .eq("id", id)
    .maybeSingle();
  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const wsState: WizardWorkspaceState = {
    slack_team_name: (ws.slack_team_name as string | null) ?? null,
    slack_team_domain: (ws.slack_team_domain as string | null) ?? null,
    company_name: (ws.company_name as string | null) ?? null,
    company_website: (ws.company_website as string | null) ?? null,
    company_scope: (ws.company_scope as "worldwide" | "national" | null) ?? null,
    company_country: (ws.company_country as string | null) ?? null,
  };

  // Optimization: description and audience don't need fresh Linkup deep
  // searches — the website step already crawled the company's web presence.
  // Reuse those cached sources and let Anthropic derive the answer (~3s vs
  // ~25s). Fall through to Linkup if derivation fails.
  if (step.id === "description") {
    const cachedSources = readCachedSources(ws.company_context, "website");
    if (cachedSources && cachedSources.length > 0) {
      try {
        const llmKey = await loadWorkspaceApiKey(id);
        const data = await deriveDescriptionFromSources(
          wsState.company_name ?? wsState.slack_team_name ?? "",
          wsState.company_website ?? "",
          cachedSources,
          llmKey,
        );
        return NextResponse.json({
          data,
          sources: cachedSources,
          derived: true,
        });
      } catch (e) {
        console.warn("[linkup/description] derived failed, falling back:", (e as Error).message);
      }
    }
  }

  // Audience step uses Linkup's fast (beta) mode for a quick, freshly-cited
  // factual answer. ~3s, 1 credit, real Linkup sources for the citation pills.
  // Falls back to deriving from cached sources via Anthropic if fast fails.
  if (step.id === "audience") {
    const decryptedKey = await loadWorkspaceLinkupKey(id);
    try {
      const client = linkupClient(decryptedKey);
      const company = wsState.company_name ?? wsState.slack_team_name ?? "";
      const website = wsState.company_website ?? "";
      const fastQuery = `Does ${company} (${website}) primarily serve B2B (businesses), B2C (consumers), or both? Answer with just "b2b", "b2c", or "both" and a one-sentence justification.`;
      const fastResult = await linkupFastAnswer(client, fastQuery);
      const parsed = parseAudienceAnswer(fastResult.answer);
      return NextResponse.json({
        data: { audience: parsed.audience, evidence: parsed.evidence ?? fastResult.answer.slice(0, 200) },
        sources: (fastResult.sources as LinkupSource[]) ?? [],
        depth: "fast",
      });
    } catch (e) {
      console.warn("[linkup/audience] fast failed, falling back to derived:", (e as Error).message);
    }

    // Fallback: derive from cached website/description sources via Anthropic.
    const cachedSources =
      readCachedSources(ws.company_context, "description") ??
      readCachedSources(ws.company_context, "website");
    if (cachedSources && cachedSources.length > 0) {
      try {
        const llmKey = await loadWorkspaceApiKey(id);
        const data = await deriveAudienceFromSources(
          wsState.company_name ?? wsState.slack_team_name ?? "",
          wsState.company_website ?? "",
          cachedSources,
          llmKey,
        );
        return NextResponse.json({
          data,
          sources: cachedSources,
          derived: true,
        });
      } catch (e) {
        console.warn("[linkup/audience] derived also failed:", (e as Error).message);
      }
    }
  }

  const regionHint = regionHintFromWorkspace(wsState.company_scope, wsState.company_country);
  const ctx = { regionHint };

  const decryptedKey = await loadWorkspaceLinkupKey(id);

  let client;
  try {
    client = linkupClient(decryptedKey);
  } catch (e) {
    return NextResponse.json(
      { error: "no_linkup_key", detail: (e as Error).message },
      { status: 412 },
    );
  }

  try {
    const query = step.query!(wsState, ctx);
    const result = await linkupStructured(client, query, step.schema!);
    return NextResponse.json({ data: result.data, sources: result.sources, query });
  } catch (e) {
    return NextResponse.json(
      { error: "linkup_search_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
}

// Parse Linkup's free-form fast-mode answer into the {audience, evidence}
// shape the wizard expects. Linkup fast doesn't do structured output, so we
// look at the first ~80 chars for the verdict word.
function parseAudienceAnswer(answer: string): { audience: "b2b" | "b2c" | "both"; evidence: string } {
  const head = answer.slice(0, 200).toLowerCase();
  let audience: "b2b" | "b2c" | "both" = "both";
  if (/\bboth\b|b2b\s*(and|\/|,|et)\s*b2c|b2c\s*(and|\/|,|et)\s*b2b/.test(head)) {
    audience = "both";
  } else if (/\bb2b\b|business[- ]to[- ]business/.test(head)) {
    audience = "b2b";
  } else if (/\bb2c\b|business[- ]to[- ]consumer|consumer/.test(head)) {
    audience = "b2c";
  }
  // Use the rest of the answer (after the verdict word) as evidence.
  return { audience, evidence: answer.replace(/^\s*(b2b|b2c|both)[\s.:,-]*/i, "").trim() };
}

function readCachedSources(
  companyContext: unknown,
  stepId: string,
): LinkupSource[] | null {
  if (!companyContext || typeof companyContext !== "object") return null;
  const steps = (companyContext as Record<string, unknown>).steps;
  if (!steps || typeof steps !== "object") return null;
  const stepData = (steps as Record<string, unknown>)[stepId];
  if (!stepData || typeof stepData !== "object") return null;
  const sources = (stepData as Record<string, unknown>).sources;
  return Array.isArray(sources) ? (sources as LinkupSource[]) : null;
}
