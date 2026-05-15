import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, listChannels, listSkills, listGlossary, listPeople } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { HomeDashboard } from "@/components/HomeDashboard";
import type { CompanyContext } from "@/components/CompanyContextCard";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin, userCanRead } from "@/lib/access";
import { effectiveConfidence, isStale } from "@/lib/freshness";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

// Build the canonical origin URL from the incoming request so the snippets
// rendered server-side match what the client sees (avoids hydration warning).
async function getOriginUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "https://slackmap-livid.vercel.app";
  return `${proto}://${host}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const sessionUser = await getSessionUser();
  const currentUserId = sessionUser?.id ?? null;

  const { data: workspace, error: workspaceErr } = await db()
    .from("workspaces")
    .select("*")
    .eq("id", ws)
    .maybeSingle();

  if (workspaceErr) {
    console.error("[home] workspace query failed", workspaceErr);
  }
  if (!workspace) redirect("/");

  if (currentUserId && !(await userCanRead(workspace.id as string, currentUserId))) {
    redirect("/no-workspace");
  }

  const isAdmin = currentUserId
    ? await userIsAdmin(workspace.id as string, currentUserId)
    : false;

  // Gate: company not yet resolved → punt to the dedicated full-screen
  // onboarding route. /onboarding handles the wizard and redirects back here
  // when company_resolved_at is set.
  if (!workspace.company_resolved_at) {
    redirect(`/onboarding?ws=${workspace.id as string}`);
  }

  const [channels, skills, glossary, people] = await Promise.all([
    listChannels(workspace.id as string),
    listSkills(workspace.id as string),
    listGlossary(workspace.id as string),
    listPeople(workspace.id as string),
  ]);

  const counts = {
    channels: channels.filter((c) => !c.archived).length,
    minedChannels: channels.filter((c) => c.mining_status === "done").length,
    skills: skills.length,
    skillsBySource: {
      slack: skills.filter((s) => s.source === "slack").length,
      freshdesk: skills.filter((s) => s.source === "freshdesk").length,
    },
    people: people.length,
    glossary: glossary.length,
  };

  const workspaceLang = (workspace.display_language as string | null) ?? "en";
  const lang = await currentLang(workspaceLang);

  // Server-side translation lookup. Reads from the row's translations JSONB
  // (cached by the bulk translation script) and falls back to the canonical
  // English value when no translation exists. Done here so client components
  // never need the translations blob.
  function trField(row: unknown, field: string, canonical: string | null): string | null {
    if (lang === "en") return canonical;
    const t = (row as { translations?: Record<string, Record<string, string | null | undefined>> | null })
      ?.translations?.[lang]?.[field];
    if (typeof t === "string" && t.trim().length > 0) return t;
    return canonical;
  }

  // Live signals — concrete proof the brain is being kept fresh.
  const lastMinedChannel = channels
    .filter((c) => c.mining_last_run_at)
    .sort((a, b) => (b.mining_last_run_at ?? "").localeCompare(a.mining_last_run_at ?? ""))[0];

  const recentSkills = [...skills]
    .filter((s) => s.last_observed_at)
    .sort((a, b) => (b.last_observed_at ?? "").localeCompare(a.last_observed_at ?? ""))
    .slice(0, 5)
    .map((s) => ({
      slug: s.slug,
      title: trField(s, "title", s.title) ?? s.title,
      type: s.type,
      source: s.source,
      lastObservedAt: s.last_observed_at,
    }));

  const lastPersonUpdated = [...people]
    .filter((p) => p.last_seen_at)
    .sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""))[0];

  // Emerging patterns: cluster skills extracted in the last 14 days by domain
  // (cross-source — Slack + Freshdesk feed the same pool). Surfaces "what
  // procedures the company is actively producing right now" as automation
  // suggestions the user can install in one shot.
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - FOURTEEN_DAYS_MS;
  const recentForPatterns = skills.filter(
    (s) => s.last_observed_at && new Date(s.last_observed_at).getTime() > cutoff,
  );
  const byDomain = new Map<
    string,
    { count: number; slack: number; freshdesk: number; samples: string[]; slugs: string[] }
  >();
  for (const s of recentForPatterns) {
    const domain = (s.domain ?? "other").trim() || "other";
    const entry = byDomain.get(domain) ?? {
      count: 0,
      slack: 0,
      freshdesk: 0,
      samples: [] as string[],
      slugs: [] as string[],
    };
    entry.count += 1;
    if (s.source === "slack") entry.slack += 1;
    if (s.source === "freshdesk") entry.freshdesk += 1;
    if (entry.samples.length < 3) entry.samples.push(trField(s, "title", s.title) ?? s.title);
    if (entry.slugs.length < 12) entry.slugs.push(s.slug);
    byDomain.set(domain, entry);
  }
  const emergingPatterns = Array.from(byDomain.entries())
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([domain, v]) => ({
      domain,
      count: v.count,
      slackCount: v.slack,
      freshdeskCount: v.freshdesk,
      samples: v.samples,
      slugs: v.slugs,
    }));

  // Stale skills count (freshness penalty). Surfaced as a quiet warning so
  // the user knows some procedures may have drifted from current practice.
  const staleSkillsCount = skills.filter((s) =>
    isStale({ confidence: s.confidence, last_observed_at: s.last_observed_at }),
  ).length;

  // High-recurrence Freshdesk patterns: skills with high source_count are
  // intents that surfaced from many tickets — prime candidates for an
  // auto-reply Claude agent. Same idea works on Slack but Freshdesk's
  // explicit ticket structure makes recurrence detection cleaner.
  const recurringFreshdesk = skills
    .filter((s) => s.source === "freshdesk" && (s.source_count ?? 0) >= 3)
    .sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0))
    .slice(0, 3)
    .map((s) => ({
      slug: s.slug,
      title: trField(s, "title", s.title) ?? s.title,
      sourceCount: s.source_count ?? 0,
      appliedCount: s.applied_count ?? 0,
      domain: s.domain ?? "support",
    }));

  // Surface enrichment for RecentSkillRow: include applied_count + effective
  // confidence so the UI can show "Used 12x" badges and stale warnings.
  const recentSkillsEnriched = recentSkills.map((s) => {
    const full = skills.find((sk) => sk.slug === s.slug);
    return {
      ...s,
      appliedCount: full?.applied_count ?? 0,
      lastAppliedAt: full?.last_applied_at ?? null,
      effectiveConfidence: full
        ? effectiveConfidence(full.confidence, full.last_observed_at)
        : 1,
    };
  });

  const liveSignals = {
    lastSlackEventAt: (workspace.last_event_received_at as string | null) ?? null,
    lastMinedChannel: lastMinedChannel
      ? {
          name: lastMinedChannel.name,
          minedAt: lastMinedChannel.mining_last_run_at,
          messageCount: lastMinedChannel.message_count_6mo,
        }
      : null,
    lastPerson: lastPersonUpdated
      ? {
          displayName: lastPersonUpdated.display_name ?? lastPersonUpdated.real_name ?? "—",
          role: trField(
            lastPersonUpdated,
            "role_extracted",
            (lastPersonUpdated as { role_extracted?: string | null }).role_extracted ?? null,
          ),
          lastSeenAt: lastPersonUpdated.last_seen_at,
        }
      : null,
    freshdeskConnectedAt: (workspace.freshdesk_connected_at as string | null) ?? null,
    freshdeskStatus: (workspace.freshdesk_status as string | null) ?? null,
    recentSkills: recentSkillsEnriched,
    emergingPatterns,
    staleSkillsCount,
    recurringFreshdesk,
  };

  const companyContext: CompanyContext = {
    name: (workspace.company_name as string | null) ?? null,
    website: (workspace.company_website as string | null) ?? null,
    description: (workspace.company_description as string | null) ?? null,
    industry: (workspace.company_industry as string | null) ?? null,
    audience: (workspace.company_audience as "b2b" | "b2c" | "both" | null) ?? null,
    tools: (workspace.company_tools as string[] | null) ?? null,
    scope: (workspace.company_scope as "worldwide" | "national" | null) ?? null,
    country: (workspace.company_country as string | null) ?? null,
    resolvedAt: (workspace.company_resolved_at as string | null) ?? null,
  };

  const originUrl = await getOriginUrl();

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
      workspaceLang={workspaceLang}
      connectedTools={{
        freshdesk: !!workspace.freshdesk_domain,
        stripe: !!workspace.stripe_key_set_at,
      }}
    >
      <HomeDashboard
        workspaceId={workspace.id as string}
        workspaceName={workspace.slack_team_name as string}
        sources={{
          slack: true,
          freshdesk: !!workspace.freshdesk_domain,
        }}
        anthropicKeySet={!!workspace.anthropic_key_set_at || !!process.env.ANTHROPIC_API_KEY}
        counts={counts}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        companyContext={companyContext}
        originUrl={originUrl}
        companyTools={(workspace.company_tools as string[] | null) ?? null}
        liveSignals={liveSignals}
        lang={lang}
      />
    </WorkspaceShell>
  );
}
