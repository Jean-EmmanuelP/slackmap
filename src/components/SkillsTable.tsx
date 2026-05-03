"use client";

import { useMemo, useState } from "react";
import type { Skill } from "@/lib/db";

const TYPE_COLORS: Record<string, string> = {
  process: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  policy: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  decision: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  escalation: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

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

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-white sticky top-0">
            <tr className="text-left text-xs uppercase text-zinc-500">
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Skill</th>
              <th className="px-6 py-3 font-medium">Trigger</th>
              <th className="px-6 py-3 font-medium text-right">Sources</th>
              <th className="px-6 py-3 font-medium text-right">Confidence</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelected(s)}
                className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
              >
                <td className="px-6 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md border text-xs ${
                      TYPE_COLORS[s.type] ?? ""
                    }`}
                  >
                    {s.type}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="font-medium text-zinc-900">{s.title}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">{s.slug}</div>
                </td>
                <td className="px-6 py-3 text-zinc-600 max-w-md truncate">{s.trigger ?? "—"}</td>
                <td className="px-6 py-3 text-right tabular-nums text-zinc-700">{s.source_count}</td>
                <td className="px-6 py-3 text-right tabular-nums">
                  <ConfidenceBar value={s.confidence} />
                </td>
                <td className="px-6 py-3">
                  <a
                    href={`/api/workspace/${workspaceId}/skills/${s.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    .md
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                  No skills extracted yet. Mining in progress?
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
              const link = teamDomain
                ? `https://${teamDomain}.slack.com/archives/${c.channel_id}/p${c.ts.replace(".", "")}`
                : null;
              return (
                <li key={i} className="text-xs text-zinc-600">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
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
