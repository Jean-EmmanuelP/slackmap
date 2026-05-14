"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanyContextCard, type CompanyContext } from "@/components/CompanyContextCard";
import { FreshdeskSignalsPanel } from "@/components/FreshdeskSignalsPanel";
import { StripeKeyModal } from "@/components/StripeKeyModal";
import { t } from "@/lib/i18n-ui";

type Counts = {
  channels: number;
  minedChannels: number;
  skills: number;
  skillsBySource: { slack: number; freshdesk: number };
  people: number;
  glossary: number;
};

type Sources = { slack: boolean; freshdesk: boolean };

export type LiveSignals = {
  lastSlackEventAt: string | null;
  lastMinedChannel: { name: string; minedAt: string | null; messageCount: number } | null;
  lastPerson: { displayName: string; role: string | null; lastSeenAt: string | null } | null;
  freshdeskConnectedAt: string | null;
  freshdeskStatus: string | null;
  recentSkills: Array<{
    slug: string;
    title: string;
    type: string;
    source: "slack" | "freshdesk" | string;
    lastObservedAt: string | null;
    appliedCount: number;
    lastAppliedAt: string | null;
    effectiveConfidence: number;
  }>;
  emergingPatterns: Array<{
    domain: string;
    count: number;
    slackCount: number;
    freshdeskCount: number;
    samples: string[];
    slugs: string[];
  }>;
  staleSkillsCount: number;
  recurringFreshdesk: Array<{
    slug: string;
    title: string;
    sourceCount: number;
    appliedCount: number;
    domain: string;
  }>;
};

type Invite = {
  id: string;
  token: string;
  url: string;
  status: string;
  uses_count: number;
  max_uses: number;
  created_at: string;
};

// Tools we know how to mine OR have on the roadmap. Maps a tool name (matched
// case-insensitively against `company_tools`) to its connection capability.
type IntegrationStatus = "connected" | "available" | "coming_soon";
type IntegrationMeta = { canonical: string; status: IntegrationStatus };

const INTEGRATIONS: Record<string, IntegrationMeta> = {
  slack: { canonical: "Slack", status: "connected" },
  freshdesk: { canonical: "Freshdesk", status: "available" },
  gmail: { canonical: "Gmail", status: "coming_soon" },
  asana: { canonical: "Asana", status: "coming_soon" },
  notion: { canonical: "Notion", status: "coming_soon" },
  linear: { canonical: "Linear", status: "coming_soon" },
  jira: { canonical: "Jira", status: "coming_soon" },
  github: { canonical: "GitHub", status: "coming_soon" },
  gitlab: { canonical: "GitLab", status: "coming_soon" },
  "google drive": { canonical: "Google Drive", status: "coming_soon" },
  figma: { canonical: "Figma", status: "coming_soon" },
  stripe: { canonical: "Stripe", status: "available" },
  hubspot: { canonical: "HubSpot", status: "coming_soon" },
  intercom: { canonical: "Intercom", status: "coming_soon" },
  zendesk: { canonical: "Zendesk", status: "coming_soon" },
  zoom: { canonical: "Zoom", status: "coming_soon" },
  outlook: { canonical: "Outlook", status: "coming_soon" },
  "microsoft teams": { canonical: "Microsoft Teams", status: "coming_soon" },
};

export function HomeDashboard({
  workspaceId,
  workspaceName,
  sources,
  anthropicKeySet,
  counts,
  currentUserId,
  isAdmin,
  companyContext,
  originUrl,
  companyTools,
  liveSignals,
  lang,
}: {
  workspaceId: string;
  workspaceName: string;
  sources: Sources;
  anthropicKeySet: boolean;
  counts: Counts;
  currentUserId: string | null;
  isAdmin: boolean;
  companyContext?: CompanyContext;
  originUrl: string;
  companyTools?: string[] | null;
  liveSignals?: LiveSignals;
  lang?: string;
}) {
  // Note: HomeDashboard sub-components destructure `lang` from this scope
  // via closure when needed; props are explicit when crossing component
  // boundaries (ToolStrip, LiveSignalsSection, etc.) below.
  void currentUserId;
  const [tab, setTab] = useState<"cli" | "agent" | "api">("cli");

  const totalEntities = counts.channels + counts.people + counts.glossary;
  const miningPct = counts.channels > 0 ? Math.round((counts.minedChannels / counts.channels) * 100) : 0;

  // Brain pulse stats — make the "Company Brain" value tangible at first glance.
  // Read defensively: shapes vary across LiveSignals revisions, fall back to 0.
  const ls = liveSignals as unknown as Record<string, { pendingDrafts?: number } | undefined>;
  const draftsPending = ls?.freshdesk?.pendingDrafts ?? 0;
  const skillsCount = (counts as { skills?: number })?.skills ?? 0;
  const endpointsProposed = (counts as { endpointsProposed?: number })?.endpointsProposed ?? 0;

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      {/* === COMPANY BRAIN HERO =====================================
        * The product proposition lives here. Big enough to anchor the
        * page; explicit enough that a YC visitor reads "Company Brain
        * for [Company]" in 2 sec and knows what we do.
        * =========================================================*/}
      <header className="border-b border-zinc-200 pb-8 mb-8">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
          {t("dashboard.orgTag", lang)} · {workspaceName}
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 max-w-3xl leading-[1.05]">
          {workspaceName}&apos;s brain.
        </h1>
        <p className="mt-3 text-base text-zinc-600 leading-relaxed max-w-2xl">
          {t("dashboard.heroLine", lang)}
        </p>

        {/* Live pulse: 3 numbers that prove the brain is alive */}
        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <BrainStat value={skillsCount} label={t("dashboard.stat.skills", lang)} />
          <BrainStat value={draftsPending} label={t("dashboard.stat.drafts", lang)} accent={draftsPending > 0} />
          <BrainStat value={endpointsProposed} label={t("dashboard.stat.endpoints", lang)} accent={endpointsProposed > 0} />
        </div>

        {/* Two primary CTAs — the actual product paths */}
        <div className="mt-6 flex flex-wrap gap-2">
          {sources.freshdesk && (
            <a
              href={`/freshdesk?ws=${workspaceId}`}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-4 py-2 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800"
            >
              {t("dashboard.openInbox", lang)}
            </a>
          )}
          <a
            href={`/audit?ws=${workspaceId}`}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-4 py-2 border border-zinc-900 text-zinc-900 hover:bg-zinc-50"
          >
            {t("dashboard.runAudit", lang)}
          </a>
        </div>
      </header>

      <div className="mt-2 grid grid-cols-12 gap-4">
        {companyContext?.resolvedAt && (
          <CompanyContextCard workspaceId={workspaceId} context={companyContext} lang={lang} />
        )}

        <ToolStrip
          workspaceId={workspaceId}
          companyTools={companyTools ?? null}
          sourcesConnected={sources}
          counts={counts.skillsBySource}
          lang={lang}
        />

        {liveSignals && (
          <LiveSignalsSection
            workspaceId={workspaceId}
            originUrl={originUrl}
            signals={liveSignals}
            sources={sources}
            lang={lang}
          />
        )}

        <FreshdeskSignalsPanel
          workspaceId={workspaceId}
          freshdeskConnected={sources.freshdesk}
          lang={lang}
        />

        {/* Stats strip */}
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200">
          <Stat label={t("stat.channels", lang)} value={counts.channels} hint={t("stat.channels.hint", lang, { n: counts.minedChannels })} />
          <Stat label={t("stat.people", lang)} value={counts.people} />
          <Stat label={t("stat.skills", lang)} value={counts.skills} hint={t("stat.skills.hint", lang)} />
          <Stat label={t("stat.glossary", lang)} value={counts.glossary} hint={t("stat.glossary.hint", lang)} />
          <Stat label={t("stat.entities", lang)} value={totalEntities} hint={t("stat.entities.hint", lang)} />
        </section>

        {/* Mining progress */}
        <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
            {t("extraction.progress", lang)}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                style={{ width: `${miningPct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-zinc-900 tabular-nums">{miningPct}%</span>
          </div>
          <p className="text-xs text-zinc-500">
            {t("extraction.progressHint", lang, { done: counts.minedChannels, total: counts.channels })}
          </p>
        </section>

        {/* LLM key */}
        <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {t("extraction.engine", lang)}
            </div>
            <span className={`size-1.5 rounded-full ${anthropicKeySet ? "bg-emerald-500" : "bg-amber-500"}`} />
          </div>
          <div className="mt-2 text-sm text-zinc-900">
            {anthropicKeySet ? t("extraction.anthropicSet", lang) : t("extraction.anthropicMissing", lang)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
            {anthropicKeySet
              ? t("extraction.anthropicSetHint", lang)
              : t("extraction.anthropicMissingHint", lang)}
          </p>
        </section>

        {/* Skills export */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-200 p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-[var(--font-mono)]">›_</span>
            <h3 className="text-lg font-medium text-zinc-900">{t("skillsBundle.exportTitle", lang)}</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{t("skillsBundle.exportSubtitle", lang)}</p>

          <div className="mt-4 flex border-b border-zinc-200">
            {(["cli", "agent", "api"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-[var(--font-mono)] ${
                  tab === t
                    ? "text-zinc-900 border-b-2 border-zinc-900 -mb-px"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t === "cli" ? "CLI" : t === "agent" ? "AI Agent" : "API"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "cli" && <CliSnippet workspaceId={workspaceId} originUrl={originUrl} />}
            {tab === "agent" && <AgentSnippet workspaceId={workspaceId} originUrl={originUrl} />}
            {tab === "api" && <ApiSnippet workspaceId={workspaceId} originUrl={originUrl} />}
          </div>
        </section>

        {/* Skills bundle */}
        <section className="col-span-12 lg:col-span-4 border border-zinc-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {t("skillsBundle.title", lang)}
            </span>
            <a
              href={`/api/workspace/${workspaceId}/skills.zip`}
              className="text-xs text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
            >
              {t("skillsBundle.downloadAll", lang)}
            </a>
          </div>
          <div className="mt-2 text-sm text-zinc-900">
            {t("skillsBundle.ready", lang, { n: counts.skills })}
          </div>
          <div className="mt-1 text-xs text-zinc-500 leading-relaxed">
            {t("skillsBundle.path", lang)}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-2">
              {t("skillsBundle.whatsInside", lang)}
            </div>
            <ul className="space-y-1 text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-violet-400" />
                {t("skillsBundle.refunds", lang)}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-blue-400" />
                {t("skillsBundle.deploy", lang)}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-emerald-400" />
                {t("skillsBundle.escalation", lang)}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-amber-400" />
                {t("skillsBundle.implicit", lang)}
              </li>
            </ul>
          </div>
        </section>

        {isAdmin && (
          <section className="col-span-12 border border-zinc-200 p-6">
            <InviteTeammate workspaceId={workspaceId} />
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-[var(--paper)] px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium text-zinc-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function CliSnippet({ workspaceId, originUrl }: { workspaceId: string; originUrl: string }) {
  const url = `${originUrl}/api/workspace/${workspaceId}/skills.zip`;
  const cmd = `curl -fsSL "${url}" -o /tmp/slackmap-skills.zip && \\\n  unzip -oq /tmp/slackmap-skills.zip -d ~/.claude/skills/ && \\\n  echo "Installed. Restart Claude Code to load."`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">Install your skills as Claude Code skills. Copy + paste in your terminal:</p>
      <Code value={cmd} />
    </div>
  );
}

function AgentSnippet({ workspaceId, originUrl }: { workspaceId: string; originUrl: string }) {
  const url = `${originUrl}/api/workspace/${workspaceId}/skills.zip`;
  const cmd = `# Cursor / Aider / custom agents\ncurl -fsSL "${url}" -o skills.zip && \\\n  unzip -oq skills.zip -d ./skills/`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">For other coding agents — drop the bundle wherever your agent loads skills:</p>
      <Code value={cmd} />
    </div>
  );
}

function ApiSnippet({ workspaceId, originUrl }: { workspaceId: string; originUrl: string }) {
  const cmd = `GET ${originUrl}/api/workspace/${workspaceId}/skills/handle-customer-refund\nAccept: text/markdown`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">Fetch a single skill as markdown — just-in-time guidance for your agent:</p>
      <Code value={cmd} />
      <p className="text-xs text-zinc-500 mt-2">
        List all: <code className="font-[var(--font-mono)]">GET /api/workspace/{workspaceId.slice(0, 8)}…/skills.zip</code>
      </p>
    </div>
  );
}

function Code({ value }: { value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-start gap-3">
      <pre className="flex-1 text-sm text-zinc-900 whitespace-pre overflow-x-auto font-[var(--font-mono)]">{value}</pre>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 border border-zinc-200 font-[var(--font-mono)] uppercase tracking-wider"
      >
        Copy
      </button>
    </div>
  );
} // Note: this `Copy` is local to a code-snippet button used only on the dev-tab UI; could be wired with t() if a polished translation is needed there.

// "Live signals" — the proof-of-life section. Surfaces the most recent
// activity per source (Slack event, mined channel, extracted skill, person
// updated) so the user feels the brain is being kept fresh, not just stored.

function BrainStat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-2xl font-medium tabular-nums ${accent ? "text-emerald-700" : "text-zinc-900"}`}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
        {label}
      </span>
    </div>
  );
}
// Below it, "Recent automations" lists the freshest extracted skills as
// candidates that can be installed into Claude Code via one curl command.
function LiveSignalsSection({
  workspaceId,
  originUrl,
  signals,
  sources,
  lang,
}: {
  workspaceId: string;
  originUrl: string;
  signals: LiveSignals;
  sources: Sources;
  lang?: string;
}) {
  const slackPulse = signals.lastSlackEventAt
    ? `${formatRelative(signals.lastSlackEventAt)}`
    : signals.lastMinedChannel?.minedAt
      ? `mined ${formatRelative(signals.lastMinedChannel.minedAt)}`
      : "no events yet";

  const freshdeskPulse = signals.freshdeskConnectedAt
    ? `connected ${formatRelative(signals.freshdeskConnectedAt)}` +
      (signals.freshdeskStatus && signals.freshdeskStatus !== "idle" ? ` · ${signals.freshdeskStatus}` : "")
    : "not connected";

  return (
    <>
      {/* Live signals — split per source */}
      <section className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-200 border border-zinc-200">
        <SignalCard
          source={t("signals.slack", lang)}
          live={sources.slack}
          pulse={slackPulse}
          lang={lang}
          detail={
            signals.lastMinedChannel ? (
              <>
                {t("signals.lastMined", lang)}: <span className="text-zinc-900">#{signals.lastMinedChannel.name}</span>
                <span className="text-zinc-500"> ({signals.lastMinedChannel.messageCount} msgs)</span>
              </>
            ) : null
          }
          person={signals.lastPerson}
        />
        <SignalCard
          source={t("signals.freshdesk", lang)}
          live={sources.freshdesk}
          pulse={freshdeskPulse}
          lang={lang}
          detail={null}
          person={null}
        />
      </section>

      {/* High-recurrence Freshdesk patterns — auto-reply agent candidates */}
      {signals.recurringFreshdesk.length > 0 && (
        <section className="col-span-12 border border-zinc-200 p-5 bg-emerald-50/30">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-800 font-[var(--font-mono)]">
                High-recurrence Freshdesk patterns
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                These intents come up across many tickets — install one as a Claude skill and an agent can auto-draft replies.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-emerald-100">
            {signals.recurringFreshdesk.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 py-2.5">
                <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-800 tabular-nums w-12">
                  {p.sourceCount}× tickets
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-900 truncate">{p.title}</div>
                  <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
                    {p.domain}
                    {p.appliedCount > 0 && ` · agent used ${p.appliedCount}×`}
                  </div>
                </div>
                <a
                  href={`/api/workspace/${workspaceId}/skills/${p.slug}`}
                  className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  View skill →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stale skills — quiet warning */}
      {signals.staleSkillsCount > 0 && (
        <section className="col-span-12 border border-amber-200 bg-amber-50/40 px-4 py-2.5 flex items-center gap-3 text-xs">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="text-zinc-700">
            <span className="font-medium text-amber-900">{signals.staleSkillsCount} skill{signals.staleSkillsCount > 1 ? "s" : ""}</span>{" "}
            haven&apos;t been re-observed recently — your team may have changed how they work.
          </span>
          <a
            href={`/skills?ws=${workspaceId}&filter=stale`}
            className="ml-auto text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-amber-800 hover:text-amber-900"
          >
            Review →
          </a>
        </section>
      )}

      {/* Emerging patterns — cross-source domain clustering */}
      {signals.emergingPatterns.length > 0 && (
        <section className="col-span-12 border border-zinc-200 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                {t("emerging.title", lang)}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t("emerging.subtitle", lang)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {signals.emergingPatterns.map((p) => (
              <PatternCard key={p.domain} pattern={p} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* Recent automations — fresh skills with one-shot install */}
      {signals.recentSkills.length > 0 && (
        <section className="col-span-12 border border-zinc-200 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                {t("signals.recentAutomations", lang)}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t("signals.recentAutomationsHint", lang)}</p>
            </div>
            <a
              href={`/api/workspace/${workspaceId}/skills.zip`}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 hover:border-zinc-900"
            >
              {t("signals.downloadAll", lang)}
            </a>
          </div>
          <ul className="divide-y divide-zinc-100">
            {signals.recentSkills.map((s) => (
              <RecentSkillRow
                key={s.slug}
                workspaceId={workspaceId}
                originUrl={originUrl}
                skill={s}
                lang={lang}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SignalCard({
  source,
  live,
  pulse,
  detail,
  person,
  lang,
}: {
  source: string;
  live: boolean;
  pulse: string;
  detail: React.ReactNode;
  person: { displayName: string; role: string | null; lastSeenAt: string | null } | null;
  lang?: string;
}) {
  return (
    <div className="bg-[var(--paper)] px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
          {source} · {pulse}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-zinc-600 leading-relaxed">
        {detail && <div>{detail}</div>}
        {person && person.lastSeenAt && (
          <div>
            {t("signals.lastPersonUpdated", lang)}:{" "}
            <span className="text-zinc-900">{person.displayName}</span>
            {person.role && <span className="text-zinc-500"> — {person.role}</span>}
            <span className="text-zinc-400"> · {formatRelative(person.lastSeenAt)}</span>
          </div>
        )}
        {!detail && !person && <div className="text-zinc-400">{t("signals.noActivity", lang)}</div>}
      </div>
    </div>
  );
}

function RecentSkillRow({
  workspaceId,
  originUrl,
  skill,
  lang,
}: {
  workspaceId: string;
  originUrl: string;
  skill: LiveSignals["recentSkills"][number];
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);
  const installCmd = `curl -fsSL "${originUrl}/api/workspace/${workspaceId}/skills/${skill.slug}" -o ~/.claude/skills/${skill.slug}.md`;
  const stale = skill.effectiveConfidence < 0.45;

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border ${
          skill.source === "freshdesk"
            ? "border-emerald-300 text-emerald-700"
            : skill.source === "slack"
              ? "border-zinc-300 text-zinc-700"
              : "border-zinc-200 text-zinc-500"
        }`}
      >
        {skill.source}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm text-zinc-900 truncate">{skill.title}</div>
          {stale && (
            <span
              className="text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1 py-0.5 border border-amber-300 bg-amber-50 text-amber-800"
              title={`Confidence has decayed (${Math.round(skill.effectiveConfidence * 100)}%) — last observed ${skill.lastObservedAt ? formatRelative(skill.lastObservedAt) : "long ago"}`}
            >
              stale
            </span>
          )}
          {skill.appliedCount > 0 && (
            <span
              className="text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1 py-0.5 border border-emerald-300 bg-emerald-50 text-emerald-800"
              title={`Applied ${skill.appliedCount}× by an installed agent${skill.lastAppliedAt ? ` · last ${formatRelative(skill.lastAppliedAt)}` : ""}`}
            >
              used {skill.appliedCount}×
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400">
          {skill.type} {skill.lastObservedAt && `· ${t("signals.extractedPrefix", lang)} ${formatRelative(skill.lastObservedAt)}`}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(installCmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 hover:border-zinc-900 text-zinc-700 hover:text-zinc-900"
      >
        {copied ? t("signals.copied", lang) : t("signals.copyInstall", lang)}
      </button>
    </li>
  );
}

// Maps a domain (the `domain` field on extracted skills) to a concrete AI
// action the user can deploy with the underlying skills. Translates the
// abstract "we found 8 procedures in this domain" into "deploy a Claude
// agent that does X across surface Y" — which is the actual product value:
// turn fragmented domain knowledge into ready-to-run automations.
const DOMAIN_AI_ACTIONS: Record<string, { action: string; agentSurface: string }> = {
  support: { action: "Auto-triage incoming tickets and draft first-line replies", agentSurface: "Freshdesk" },
  refund: { action: "Pre-validate refund requests, auto-approve under threshold", agentSurface: "Freshdesk + Stripe" },
  billing: { action: "Resolve recurring billing/pricing questions without an agent", agentSurface: "Freshdesk" },
  onboarding: { action: "AI buddy that answers new-hire process questions", agentSurface: "Slack" },
  deploy: { action: "Notify on deploys, propose rollbacks based on past incidents", agentSurface: "Slack + GitHub" },
  ops: { action: "Daily ops summary, escalation routing", agentSurface: "Slack" },
  product: { action: "Surface user feedback themes weekly with auto-tagging", agentSurface: "Slack + Linear" },
  engineering: { action: "Code review with company conventions, incident playbook", agentSurface: "GitHub + Slack" },
  pricing: { action: "Auto-validate promo codes against your pricing rules", agentSurface: "Stripe" },
  marketing: { action: "Draft campaign briefs grounded in past launches", agentSurface: "Slack" },
  hr: { action: "Resolve HR / payroll questions from past Slack precedents", agentSurface: "Slack" },
};

function aiActionFor(
  domain: string,
  lang: string | undefined,
): { action: string; agentSurface: string } {
  const key = domain.trim().toLowerCase();
  // Try the i18n bundle first (covers all known domains in EN + FR).
  let bundleKey = DOMAIN_AI_ACTIONS[key] ? key : null;
  if (!bundleKey) {
    for (const k of Object.keys(DOMAIN_AI_ACTIONS)) {
      if (key.includes(k)) {
        bundleKey = k;
        break;
      }
    }
  }
  if (bundleKey) {
    return {
      action: t(`domain.${bundleKey}.action`, lang),
      agentSurface: t(`domain.${bundleKey}.surface`, lang),
    };
  }
  return {
    action: t("domain.fallback.action", lang, { domain }),
    agentSurface: t("domain.fallback.surface", lang),
  };
}

function PatternCard({
  pattern,
  lang,
}: {
  pattern: LiveSignals["emergingPatterns"][number];
  lang?: string;
}) {
  const sources = [
    pattern.slackCount > 0 ? `${pattern.slackCount} Slack` : null,
    pattern.freshdeskCount > 0 ? `${pattern.freshdeskCount} Freshdesk` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ai = aiActionFor(pattern.domain, lang);

  return (
    <div className="border border-zinc-200 p-4 bg-[var(--paper)] flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900 capitalize truncate">{pattern.domain}</span>
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
          {t("emerging.skillsCount", lang, { n: pattern.count })}
        </span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)]">
        {sources}
      </div>

      {/* Suggested AI deployment derived from the domain */}
      <div className="mt-3 border-l-2 border-zinc-900 pl-2.5">
        <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-[var(--font-mono)]">
          {t("emerging.aiAction", lang)}
        </div>
        <p className="mt-0.5 text-xs text-zinc-900 leading-snug">{ai.action}</p>
        <div className="mt-1 text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
          {t("emerging.runsOn", lang, { surface: ai.agentSurface })}
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-zinc-500 flex-1">
        {pattern.samples.slice(0, 2).map((title, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="text-zinc-400 mt-0.5">·</span>
            <span className="truncate">{title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 8) return `${diffWk}w ago`;
  return new Date(iso).toLocaleDateString();
}

// Compact horizontal strip of the user's tools, with connection state.
// Replaces the old Sources hero. Driven by the wizard's company_tools list.
function ToolStrip({
  workspaceId,
  companyTools,
  sourcesConnected,
  counts,
  lang,
}: {
  workspaceId: string;
  companyTools: string[] | null;
  sourcesConnected: { slack: boolean; freshdesk: boolean };
  counts: { slack: number; freshdesk: number };
  lang?: string;
}) {
  const tools = companyTools ?? [];

  if (tools.length === 0) {
    return (
      <section className="col-span-12 border border-zinc-200 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            {t("tools.sources", lang)}
          </div>
          <p className="mt-1 text-sm text-zinc-700">{t("tools.unknownStack", lang)}</p>
        </div>
        <a
          href={`/onboarding?ws=${workspaceId}`}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800"
        >
          {t("tools.runOnboarding", lang)}
        </a>
      </section>
    );
  }

  // Always include Slack first, even if user didn't list it (the workspace
  // exists because of Slack OAuth — it's implied).
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const name of ["Slack", ...tools]) {
    const key = name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(name.trim());
    }
  }

  return (
    <section className="col-span-12 border border-zinc-200 px-5 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mr-1">
          {t("tools.sources", lang)}
        </span>
        {ordered.map((name) => (
          <ToolChip
            key={name}
            name={name}
            sourcesConnected={sourcesConnected}
            counts={counts}
            workspaceId={workspaceId}
            lang={lang}
          />
        ))}
      </div>
    </section>
  );
}

function StripeChip({
  workspaceId,
  display,
  lang,
}: {
  workspaceId: string;
  display: string;
  lang?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-2.5 py-1 border border-zinc-300 hover:border-zinc-900 text-xs text-zinc-700 hover:text-zinc-900"
      >
        <span className="size-1.5 rounded-full bg-zinc-400" />
        {display}
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
          {t("tools.connect", lang)}
        </span>
      </button>
      <StripeKeyModal workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ToolChip({
  name,
  sourcesConnected,
  counts,
  workspaceId,
  lang,
}: {
  name: string;
  sourcesConnected: { slack: boolean; freshdesk: boolean };
  counts: { slack: number; freshdesk: number };
  workspaceId: string;
  lang?: string;
}) {
  const meta = INTEGRATIONS[name.trim().toLowerCase()];

  // Resolve effective status from runtime sources, not just the static map.
  let status: IntegrationStatus | "custom";
  if (!meta) {
    status = "custom";
  } else if (meta.canonical === "Slack") {
    status = sourcesConnected.slack ? "connected" : "available";
  } else if (meta.canonical === "Freshdesk") {
    status = sourcesConnected.freshdesk ? "connected" : "available";
  } else {
    status = meta.status;
  }

  const display = meta?.canonical ?? name;
  const skillCount =
    display === "Slack" ? counts.slack : display === "Freshdesk" ? counts.freshdesk : null;

  if (status === "connected") {
    // Freshdesk has its own deep-dive page. Slack's lives under /atlas
    // (channel graph). Make the chip a link so users can drill into evidence.
    const href =
      display === "Freshdesk"
        ? `/freshdesk?ws=${workspaceId}`
        : display === "Slack"
          ? `/atlas?ws=${workspaceId}`
          : null;

    const inner = (
      <>
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {display}
        {skillCount !== null && skillCount > 0 && (
          <span className="text-[10px] tabular-nums font-[var(--font-mono)] text-zinc-500">
            · {t("tools.skillsCount", lang, { n: skillCount })}
          </span>
        )}
        {href && <span className="text-[10px] text-zinc-400">→</span>}
      </>
    );

    return href ? (
      <a
        href={href}
        className="inline-flex items-center gap-2 px-2.5 py-1 border border-emerald-200 bg-emerald-50/40 text-xs text-zinc-900 hover:border-emerald-400 hover:bg-emerald-50"
      >
        {inner}
      </a>
    ) : (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 border border-emerald-200 bg-emerald-50/40 text-xs text-zinc-900">
        {inner}
      </span>
    );
  }

  if (status === "available") {
    // Stripe gets a click-to-paste-key modal; Freshdesk goes to its connect page.
    if (display === "Stripe") {
      return <StripeChip workspaceId={workspaceId} display={display} lang={lang} />;
    }
    return (
      <a
        href={display === "Freshdesk" ? `/atlas?ws=${workspaceId}` : "#"}
        className="inline-flex items-center gap-2 px-2.5 py-1 border border-zinc-300 hover:border-zinc-900 text-xs text-zinc-700 hover:text-zinc-900"
      >
        <span className="size-1.5 rounded-full bg-zinc-400" />
        {display}
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
          {t("tools.connect", lang)}
        </span>
      </a>
    );
  }

  if (status === "coming_soon") {
    return (
      <span
        className="inline-flex items-center gap-2 px-2.5 py-1 border border-zinc-200 bg-zinc-50/50 text-xs text-zinc-500"
        title="On the roadmap — we'll wire this integration soon"
      >
        <span className="size-1.5 rounded-full bg-amber-400" />
        {display}
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400">
          {t("tools.soon", lang)}
        </span>
      </span>
    );
  }

  // Custom (user-typed, not in our integration map)
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 border border-zinc-200 text-xs text-zinc-600">
      <span className="size-1.5 rounded-full bg-zinc-300" />
      {display}
    </span>
  );
}

function InviteTeammate({ workspaceId }: { workspaceId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, { cache: "no-store" });
      if (!res.ok) { setError(`Failed (${res.status})`); setInvites([]); return; }
      setInvites(((await res.json()).invites ?? []) as Invite[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  async function createInvite() {
    setCreating(true); setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, { method: "POST" });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return; }
      const json = await res.json();
      try { await navigator.clipboard.writeText(json.url); setCopiedId(json.invite?.id ?? "new"); setTimeout(() => setCopiedId(null), 2000); } catch {}
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setCreating(false); }
  }

  async function revoke(inviteId: string) {
    setError(null);
    const res = await fetch(`/api/workspace/${workspaceId}/invites/${inviteId}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return; }
    await load();
  }

  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(url); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch (e) { setError(e instanceof Error ? e.message : "Copy failed"); }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">Team</div>
          <h3 className="mt-1 text-lg font-medium text-zinc-900">Invite a teammate</h3>
          <p className="mt-1 text-sm text-zinc-500 max-w-lg leading-relaxed">Generate a one-click link. Anyone with this URL can join the workspace after signing in.</p>
        </div>
        <button onClick={createInvite} disabled={creating} className="shrink-0 text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50">
          {creating ? "Generating…" : "Invite teammate"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}
      <div className="mt-5">
        {loading ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">No active invites yet.</p>
        ) : (
          <ul className="border border-zinc-200 divide-y divide-zinc-200">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="font-[var(--font-mono)] text-zinc-700 text-xs truncate flex-1">…{inv.token.slice(-8)}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] tabular-nums">{inv.uses_count}/{inv.max_uses}</span>
                <button onClick={() => copy(inv.url, inv.id)} className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 hover:border-zinc-500 text-zinc-700 hover:text-zinc-900">
                  {copiedId === inv.id ? "Copied" : "Copy link"}
                </button>
                <button onClick={() => revoke(inv.id)} className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 text-zinc-500 hover:text-red-700">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
