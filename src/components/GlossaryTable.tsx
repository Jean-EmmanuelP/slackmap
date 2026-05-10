"use client";

import { useMemo, useState } from "react";
import type { GlossaryEntry } from "@/lib/db";
import { SourceBadge } from "./SourceBadge";

const CATEGORIES = ["all", "product", "acronym", "jargon", "tool", "team"] as const;

// Translation lookup against glossary_entries.translations JSONB.
function tr(e: GlossaryEntry, lang: string | undefined): string {
  const code = (lang ?? "en").toLowerCase();
  if (code === "en") return e.definition;
  type WithTranslations = GlossaryEntry & {
    translations?: Record<string, Record<string, string | null | undefined>> | null;
  };
  const t = (e as WithTranslations).translations?.[code]?.definition;
  if (typeof t === "string" && t.trim().length > 0) return t;
  return e.definition;
}

export function GlossaryTable({
  entries,
  teamDomain,
  lang,
}: {
  entries: GlossaryEntry[];
  teamDomain: string | null;
  lang?: string;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (ql.length === 0) return true;
      return (
        e.term.toLowerCase().includes(ql) ||
        e.definition.toLowerCase().includes(ql) ||
        tr(e, lang).toLowerCase().includes(ql)
      );
    });
  }, [entries, q, cat, lang]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-200 flex-wrap">
        <input
          type="search"
          placeholder="Search terms or definitions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
        <div className="flex border border-zinc-300">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors ${
                i > 0 ? "border-l border-zinc-300" : ""
              } ${
                cat === c
                  ? "bg-zinc-900 text-[var(--paper)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-500 font-[var(--font-mono)]">{filtered.length} entries</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--paper)] border-b border-zinc-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              <th className="px-6 py-2.5 font-medium">Term</th>
              <th className="px-6 py-2.5 font-medium">Definition</th>
              <th className="px-6 py-2.5 font-medium">Source</th>
              <th className="px-6 py-2.5 font-medium">Category</th>
              <th className="px-6 py-2.5 font-medium text-right">Occurrences</th>
              <th className="px-6 py-2.5 font-medium">First seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-zinc-200 hover:bg-zinc-100/50">
                <td className="px-6 py-3 font-[var(--font-mono)] text-zinc-900">{e.term}</td>
                <td className="px-6 py-3 text-zinc-700">{tr(e, lang)}</td>
                <td className="px-6 py-3"><SourceBadge source={e.source} /></td>
                <td className="px-6 py-3">
                  <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)]">
                    {e.category ?? "—"}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-zinc-500 tabular-nums font-[var(--font-mono)]">
                  {e.occurrences}
                </td>
                <td className="px-6 py-3 text-zinc-500">
                  {teamDomain && e.first_seen_channel_id && e.first_seen_ts ? (
                    <a
                      href={`https://${teamDomain}.slack.com/archives/${e.first_seen_channel_id}/p${e.first_seen_ts.replace(".", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2 font-[var(--font-mono)]"
                    >
                      View →
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                  No entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
