"use client";

import { useMemo, useState } from "react";
import type { Skill } from "@/lib/db";
import { SourceBadge } from "./SourceBadge";

const TYPE_COLORS: Record<string, string> = {
  process: "bg-blue-50 text-blue-700 border-blue-200",
  policy: "bg-amber-50 text-amber-700 border-amber-200",
  decision: "bg-purple-50 text-purple-700 border-purple-200",
  escalation: "bg-rose-50 text-rose-700 border-rose-200",
};

const DOMAIN_LABELS: Record<string, string> = {
  engineering: "Engineering",
  product: "Product",
  support: "Support",
  ops: "Operations",
  sales: "Sales",
  marketing: "Marketing",
  leadership: "Leadership",
  other: "Other",
};

const DOMAIN_ORDER = [
  "engineering",
  "product",
  "support",
  "ops",
  "sales",
  "marketing",
  "leadership",
  "other",
];

export function SkillsTable({
  skills,
  workspaceId,
  teamDomain,
}: {
  skills: Skill[];
  workspaceId: string;
  teamDomain: string | null;
}) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Skill["type"]>("all");
  const [selected, setSelected] = useState<Skill | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return skills.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (ql.length === 0) return true;
      return (
        s.title.toLowerCase().includes(ql) ||
        s.slug.toLowerCase().includes(ql) ||
        (s.trigger?.toLowerCase().includes(ql) ?? false)
      );
    });
  }, [skills, q, typeFilter]);

  const types: Array<"all" | Skill["type"]> = ["all", "process", "policy", "decision", "escalation"];

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-zinc-200">
        <input
          type="search"
          placeholder="Search skills…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 rounded-md bg-white border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-1">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                typeFilter === t
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-white text-zinc-600 hover:text-zinc-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <a
          href={`/api/workspace/${workspaceId}/skills.zip`}
          className="ml-auto px-3 py-1.5 rounded-md text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
        >
          ⬇ Export Claude skills bundle
        </a>
        <span className="text-xs text-zinc-500">{filtered.length} skills</span>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-400 text-sm">
            No skills extracted yet. Mining in progress?
          </div>
        ) : (
          DOMAIN_ORDER.map((domain) => {
            const group = filtered.filter((s) => (s.domain ?? "other") === domain);
            if (group.length === 0) return null;
            return (
              <section key={domain} className="border-b border-zinc-200">
                <header className="sticky top-0 z-10 px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="font-[var(--font-serif)] text-base text-zinc-900">
                    {DOMAIN_LABELS[domain] ?? domain}
                  </h3>
                  <span className="text-xs text-zinc-500 tabular-nums">{group.length} skills</span>
                </header>
                <ul className="divide-y divide-zinc-100">
                  {group.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="px-6 py-4 hover:bg-zinc-50 cursor-pointer flex items-start gap-4"
                    >
                      <span
                        className={`mt-1 inline-block px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide shrink-0 ${
                          TYPE_COLORS[s.type] ?? ""
                        }`}
                      >
                        {s.type}
                      </span>
                      <span className="mt-1"><SourceBadge source={s.source} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-900 text-sm">{s.title}</div>
                        {s.trigger && (
                          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{s.trigger}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <ConfidenceBar value={s.confidence} />
                        <a
                          href={`/api/workspace/${workspaceId}/skills/${s.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-700 hover:text-blue-900"
                        >
                          .md
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {selected && <SkillPanel skill={selected} teamDomain={teamDomain} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.75 ? "bg-emerald-500" : value >= 0.5 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SkillPanel({
  skill,
  teamDomain,
  onClose,
}: {
  skill: Skill;
  teamDomain: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-[640px] h-full bg-white border-l border-zinc-200 overflow-y-auto p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800"
        >
          ✕
        </button>
        <div
          className={`inline-block px-2 py-0.5 rounded-md border text-xs mb-3 ${
            TYPE_COLORS[skill.type] ?? ""
          }`}
        >
          {skill.type}
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900">{skill.title}</h2>
        <p className="text-xs text-zinc-500 font-mono mt-1">{skill.slug}</p>

        {skill.trigger && (
          <Section title="Trigger">
            <p className="text-zinc-700">{skill.trigger}</p>
          </Section>
        )}
        {skill.steps_md && (
          <Section title="Steps">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{skill.steps_md}</pre>
          </Section>
        )}
        {skill.decision_criteria && (
          <Section title="Decision criteria">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{skill.decision_criteria}</pre>
          </Section>
        )}
        {skill.escalation && (
          <Section title="Escalation">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{skill.escalation}</pre>
          </Section>
        )}

        <Section title={`Sources (${skill.citations.length})`}>
          <ul className="space-y-2">
            {skill.citations.map((c, i) => {
              const link =
                c.url ??
                (teamDomain && !c.channel_id.startsWith("freshdesk-")
                  ? `https://${teamDomain}.slack.com/archives/${c.channel_id}/p${c.ts.replace(".", "")}`
                  : null);
              return (
                <li key={i} className="text-xs text-zinc-600">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900">
                      {c.snippet ? `"${c.snippet.slice(0, 100)}…"` : `${c.channel_id} @ ${c.ts}`}
                    </a>
                  ) : (
                    <span>{c.snippet ?? `${c.channel_id} @ ${c.ts}`}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}
