"use client";

import { useState } from "react";
import { FreshdeskSignalsPanel } from "@/components/FreshdeskSignalsPanel";

type Domain = { domain: string; count: number; sample: string[]; topRecurrence: number };
type RecurringSkill = {
  slug: string;
  title: string;
  domain: string | null;
  sourceCount: number;
  appliedCount: number;
  lastObservedAt: string | null;
};
type Agent = {
  slackUserId: string;
  displayName: string;
  role: string | null;
  messageCount: number;
  lastSeenAt: string | null;
};
type GlossarySample = { term: string; definition: string; occurrences: number };

export function FreshdeskInsights({
  workspaceId,
  domain,
  connectedAt,
  status,
  anthropicKeySet,
  totals,
  domains,
  recurringSkills,
  agents,
  glossarySamples,
}: {
  workspaceId: string;
  domain: string;
  connectedAt: string | null;
  status: string | null;
  anthropicKeySet: boolean;
  totals: {
    skills: number;
    glossary: number;
    agents: number;
    signalsTotal: number;
    signalsNew: number;
  };
  domains: Domain[];
  recurringSkills: RecurringSkill[];
  agents: Agent[];
  glossarySamples: GlossarySample[];
}) {
  const [reExtracting, setReExtracting] = useState(false);
  const [reExtractError, setReExtractError] = useState<string | null>(null);

  async function reRunExtraction() {
    setReExtracting(true);
    setReExtractError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/freshdesk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `${res.status}`);
      }
      // Soft refresh
      window.location.reload();
    } catch (e) {
      setReExtractError(e instanceof Error ? e.message : "Failed");
    } finally {
      setReExtracting(false);
    }
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            Tool · Freshdesk
          </div>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-zinc-900">{domain}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            What slackmap has analyzed and learned from your support queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-[var(--font-mono)] uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected{connectedAt && ` · ${formatRelative(connectedAt)}`}
          </span>
          {status && status !== "idle" && (
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 px-2 py-0.5 border border-zinc-200">
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Anthropic key warning — explains why analysis might be empty */}
      {!anthropicKeySet && (
        <div className="mt-4 border border-amber-300 bg-amber-50/40 px-4 py-2.5 flex items-center gap-3 text-xs">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="text-zinc-700">
            <span className="font-medium text-amber-900">No Anthropic API key configured.</span>{" "}
            The daily extractor (5am UTC) needs a key to call the LLM — without it, no skills, no
            glossary, no signals get extracted from new tickets.
          </span>
          <a
            href={`/home?ws=${workspaceId}`}
            className="ml-auto text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-amber-800 hover:text-amber-900"
          >
            Add key →
          </a>
        </div>
      )}

      {/* Continuous analysis proof */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200">
        <Stat label="Skills" value={totals.skills} hint="extracted" />
        <Stat label="Glossary" value={totals.glossary} hint="terms" />
        <Stat label="Agents" value={totals.agents} hint="profiled" />
        <Stat label="Signals" value={totals.signalsTotal} hint={`${totals.signalsNew} new`} />
        <Stat label="Cron" value="05:00 UTC" hint="every day" mono />
      </section>

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={reRunExtraction}
          disabled={reExtracting}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
        >
          {reExtracting ? "Re-running…" : "Re-run extraction now"}
        </button>
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
          rebuild skills + glossary + agents from current Freshdesk state
        </span>
      </div>
      {reExtractError && (
        <p className="mt-2 text-xs text-red-700 font-[var(--font-mono)]">{reExtractError}</p>
      )}

      <div className="mt-8 grid grid-cols-12 gap-4">
        {/* Signals (reuses the home dashboard's panel) */}
        <FreshdeskSignalsPanel workspaceId={workspaceId} freshdeskConnected={true} />

        {/* Domain groups — proves the brain clustered tickets */}
        {domains.length > 0 && (
          <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
              Groups detected
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              How the LLM clustered your support knowledge by domain.
            </p>
            <ul className="space-y-3">
              {domains.map((d) => (
                <li key={d.domain} className="border-l-2 border-zinc-900 pl-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 capitalize">{d.domain}</span>
                    <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
                      {d.count} skills · top {d.topRecurrence}× tickets
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                    {d.sample.map((title, i) => (
                      <li key={i} className="truncate">· {title}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recurring skills — patterns by ticket recurrence */}
        {recurringSkills.length > 0 && (
          <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
              Recurring patterns
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Skills that appeared across multiple tickets — auto-reply candidates.
            </p>
            <ul className="divide-y divide-zinc-100">
              {recurringSkills.map((s) => (
                <li key={s.slug} className="flex items-center gap-3 py-2">
                  <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-800 tabular-nums w-12 shrink-0">
                    {s.sourceCount}× tix
                  </span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/api/workspace/${workspaceId}/skills/${s.slug}`}
                      className="text-sm text-zinc-900 hover:underline truncate block"
                    >
                      {s.title}
                    </a>
                    <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400">
                      {s.domain ?? "support"}
                      {s.appliedCount > 0 && ` · used ${s.appliedCount}×`}
                      {s.lastObservedAt && ` · ${formatRelative(s.lastObservedAt)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Agents detected */}
        {agents.length > 0 && (
          <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
              Agents detected
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Support team members the brain has profiled from Freshdesk.
            </p>
            <ul className="divide-y divide-zinc-100">
              {agents.map((a) => (
                <li key={a.slackUserId} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-900 truncate">{a.displayName}</div>
                    <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
                      {a.role ?? "Support"}
                      {a.messageCount > 0 && ` · ${a.messageCount} tickets`}
                      {a.lastSeenAt && ` · ${formatRelative(a.lastSeenAt)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Glossary samples */}
        {glossarySamples.length > 0 && (
          <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
              Glossary from tickets
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Domain-specific terms the brain extracted from support tickets.
            </p>
            <ul className="divide-y divide-zinc-100">
              {glossarySamples.map((g) => (
                <li key={g.term} className="py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-zinc-900">{g.term}</span>
                    {g.occurrences > 1 && (
                      <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
                        {g.occurrences}×
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{g.definition}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty state — analysis hasn't started yet */}
        {totals.skills === 0 && totals.glossary === 0 && totals.agents === 0 && (
          <section className="col-span-12 border border-zinc-200 p-8 text-center">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
              Nothing analyzed yet
            </div>
            <p className="text-sm text-zinc-700 max-w-md mx-auto">
              {anthropicKeySet
                ? "The Freshdesk extractor hasn't produced anything yet. Hit Re-run extraction now to trigger it manually."
                : "Add an Anthropic API key, then re-run extraction. Without a key the daily job can't call the LLM."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: number | string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-[var(--paper)] px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-medium text-zinc-900 ${mono ? "font-[var(--font-mono)] text-base mt-2" : "tabular-nums"}`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
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
  return new Date(iso).toLocaleDateString();
}
