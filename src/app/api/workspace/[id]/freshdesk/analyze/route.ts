import { NextRequest, NextResponse } from "next/server";
import {
  getWorkspaceFreshdesk,
  listSkills,
  upsertFreshdeskSignals,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { analyzeFreshdeskTickets, type SkillCatalogEntry } from "@/lib/freshdesk-signals";

// POST /api/workspace/:id/freshdesk/analyze
// Pulls the most recent N Freshdesk tickets, runs them through the LLM
// triage, and persists the resulting signals. Returns counts so the client
// can refresh its dashboard surface.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10)));

  const conn = await getWorkspaceFreshdesk(id);
  if (!conn) {
    return NextResponse.json(
      { error: "freshdesk_not_connected", detail: "Connect Freshdesk first." },
      { status: 412 },
    );
  }

  let fd: FreshdeskClient;
  try {
    fd = new FreshdeskClient(conn.domain, decrypt(conn.encryptedKey));
  } catch (e) {
    return NextResponse.json(
      { error: "freshdesk_init_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }

  const tickets = await fd.listRecentTickets({ perPage: limit, pages: 1 }).catch(() => []);
  if (tickets.length === 0) {
    return NextResponse.json({ analyzed: 0, signals: 0, note: "No tickets returned by Freshdesk." });
  }

  const skills = await listSkills(id);
  const skillCatalog: SkillCatalogEntry[] = skills
    .filter((s) => s.status !== "superseded")
    .map((s) => ({ slug: s.slug, title: s.title, trigger: s.trigger }));

  const llmKey = await loadWorkspaceApiKey(id);

  let signals;
  try {
    signals = await analyzeFreshdeskTickets({ fd, apiKey: llmKey, tickets, skillCatalog });
  } catch (e) {
    return NextResponse.json(
      { error: "analyze_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  if (signals.length === 0) {
    return NextResponse.json({ analyzed: tickets.length, signals: 0, note: "No actionable signals." });
  }

  await upsertFreshdeskSignals(id, signals);

  // Summary breakdown for UX feedback.
  const byUrgency: Record<string, number> = {};
  for (const s of signals) byUrgency[s.urgency] = (byUrgency[s.urgency] ?? 0) + 1;

  return NextResponse.json({
    analyzed: tickets.length,
    signals: signals.length,
    byUrgency,
  });
}
