import { redirect } from "next/navigation";
import { db, listSkills, listGlossary, listPeople, listAgentRuns } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { FreshdeskInsights } from "@/components/FreshdeskInsights";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

// Per-tool drill-down: everything the brain knows about this workspace's
// Freshdesk integration. Proves the analysis is real (last syncs, ticket
// groups analyzed, recurring patterns) and surfaces all derived knowledge
// (agents, skills, glossary, signals) in one place.
export default async function FreshdeskPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const sessionUser = await getSessionUser();
  const currentUserId = sessionUser?.id ?? null;

  const { data: workspaceRaw } = await db()
    .from("workspaces")
    .select("*")
    .eq("id", ws)
    .maybeSingle();
  const workspace = workspaceRaw as Record<string, unknown> | null;
  if (!workspace) redirect("/");

  if (currentUserId && !(await userCanRead(workspace.id as string, currentUserId))) {
    redirect("/no-workspace");
  }

  if (!workspace.freshdesk_domain) {
    // Not connected → punt to home which surfaces the connect CTA.
    redirect(`/home?ws=${workspace.id as string}`);
  }

  const [
    allSkills,
    allGlossary,
    allPeople,
    signalsCountRes,
    openSignalsRes,
    recentRuns,
    pendingCountRes,
    sentCountRes,
    rejectedCountRes,
  ] = await Promise.all([
    listSkills(workspace.id as string),
    listGlossary(workspace.id as string),
    listPeople(workspace.id as string),
    db()
      .from("freshdesk_signals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id as string),
    db()
      .from("freshdesk_signals")
      .select("urgency", { count: "exact" })
      .eq("workspace_id", workspace.id as string)
      .eq("status", "new"),
    // The Inbox shows ALL recent runs (pending + sent + rejected) so Marc
    // sees both what's awaiting him AND the history. The full queue with
    // filters lives at /agent.
    listAgentRuns(workspace.id as string, { limit: 20 }),
    db()
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id as string)
      .eq("status", "pending"),
    db()
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id as string)
      .eq("status", "sent"),
    db()
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id as string)
      .eq("status", "rejected"),
  ]);

  const fdSkills = allSkills.filter((s) => s.source === "freshdesk");
  const fdGlossary = allGlossary.filter((g) => g.source === "freshdesk");
  const fdAgents = allPeople.filter((p) =>
    Array.isArray((p as { tools?: string[] }).tools) &&
    ((p as { tools: string[] }).tools).includes("Freshdesk"),
  );

  const workspaceLang = (workspace.display_language as string | null) ?? "en";
  const lang = await currentLang(workspaceLang);

  // Server-side translation lookup against the row's translations JSONB.
  function trField(row: unknown, field: string, canonical: string | null): string | null {
    if (lang === "en") return canonical;
    const t = (row as { translations?: Record<string, Record<string, string | null | undefined>> | null })
      ?.translations?.[lang]?.[field];
    if (typeof t === "string" && t.trim().length > 0) return t;
    return canonical;
  }

  // Domain clusters detected from Freshdesk extraction — proves the brain
  // grouped tickets meaningfully.
  const byDomain = new Map<string, { count: number; sample: string[]; topRecurrence: number }>();
  for (const s of fdSkills) {
    const d = (s.domain ?? "other").trim() || "other";
    const e = byDomain.get(d) ?? { count: 0, sample: [] as string[], topRecurrence: 0 };
    e.count += 1;
    if (e.sample.length < 3) e.sample.push(trField(s, "title", s.title) ?? s.title);
    if ((s.source_count ?? 0) > e.topRecurrence) e.topRecurrence = s.source_count ?? 0;
    byDomain.set(d, e);
  }
  const domains = Array.from(byDomain.entries())
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.count - a.count);

  const newSignalsCount =
    (openSignalsRes.count as number | null | undefined) ??
    (Array.isArray(openSignalsRes.data) ? openSignalsRes.data.length : 0);

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
      workspaceLang={workspaceLang}
      connectedTools={{ freshdesk: true, stripe: !!workspace.stripe_key_set_at }}
    >
      <FreshdeskInsights
        workspaceId={workspace.id as string}
        domain={workspace.freshdesk_domain as string}
        connectedAt={(workspace.freshdesk_connected_at as string | null) ?? null}
        status={(workspace.freshdesk_status as string | null) ?? null}
        anthropicKeySet={!!workspace.anthropic_key_set_at}
        stripeConnected={!!workspace.stripe_key_set_at}
        lang={lang}
        inboxRuns={recentRuns.map((r) => ({
          id: r.id,
          ticketSubject: r.ticket_subject,
          urgency: r.urgency,
          category: r.category,
          requesterEmail: r.requester_email,
          matchedSkillSlugs: r.matched_skill_slugs,
          draftSnippet: r.draft_original
            ? r.draft_original.slice(0, 180).replace(/\s+/g, " ").trim()
            : null,
          status: r.status,
          createdAt: r.created_at,
        }))}
        runCounts={{
          pending: (pendingCountRes.count as number | null) ?? 0,
          sent: (sentCountRes.count as number | null) ?? 0,
          rejected: (rejectedCountRes.count as number | null) ?? 0,
        }}
        totals={{
          skills: fdSkills.length,
          glossary: fdGlossary.length,
          agents: fdAgents.length,
          signalsTotal: (signalsCountRes.count as number | null) ?? 0,
          signalsNew: newSignalsCount,
        }}
        domains={domains}
        recurringSkills={fdSkills
          .filter((s) => (s.source_count ?? 0) >= 2)
          .sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0))
          .slice(0, 10)
          .map((s) => ({
            slug: s.slug,
            title: trField(s, "title", s.title) ?? s.title,
            domain: s.domain,
            sourceCount: s.source_count ?? 0,
            appliedCount: s.applied_count ?? 0,
            lastObservedAt: s.last_observed_at,
          }))}
        agents={fdAgents
          .sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""))
          .slice(0, 12)
          .map((p) => ({
            slackUserId: (p as { slack_user_id?: string }).slack_user_id ?? "",
            displayName:
              (p as { display_name?: string | null }).display_name ??
              (p as { real_name?: string | null }).real_name ??
              "—",
            role: trField(
              p,
              "role_extracted",
              (p as { role_extracted?: string | null }).role_extracted ?? null,
            ),
            messageCount:
              (p as { message_count?: number | null }).message_count ?? 0,
            lastSeenAt: (p as { last_seen_at?: string | null }).last_seen_at ?? null,
          }))}
        glossarySamples={fdGlossary
          .sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""))
          .slice(0, 12)
          .map((g) => ({
            term: g.term,
            definition: trField(g, "definition", g.definition) ?? g.definition,
            occurrences: (g as { occurrences?: number }).occurrences ?? 1,
          }))}
      />
    </WorkspaceShell>
  );
}
