"use client";

import { useMemo, useState } from "react";
import type { GlossaryEntry } from "@/lib/db";
import { SourceBadge } from "./SourceBadge";

const CATEGORIES = ["all", "product", "acronym", "jargon", "tool", "team"] as const;

export function GlossaryTable({
  entries,
  teamDomain,
}: {
  entries: GlossaryEntry[];
  teamDomain: string | null;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (ql.length === 0) return true;
      return e.term.toLowerCase().includes(ql) || e.definition.toLowerCase().includes(ql);
    });
  }, [entries, q, cat]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-zinc-200">
        <input
          type="search"
          placeholder="Search terms or definitions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 rounded-md bg-white border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
        />
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                cat === c
                  ? "bg-zinc-900 text-white"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-500">{filtered.length} entries</span>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200">
            <tr className="text-left text-xs uppercase text-zinc-500">
              <th className="px-6 py-3 font-medium">Term</th>
              <th className="px-6 py-3 font-medium">Definition</th>
              <th className="px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium text-right">Occurrences</th>
              <th className="px-6 py-3 font-medium">First seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-6 py-3 font-mono text-zinc-900">{e.term}</td>
                <td className="px-6 py-3 text-zinc-700">{e.definition}</td>
                <td className="px-6 py-3"><SourceBadge source={e.source} /></td>
                <td className="px-6 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-xs">
                    {e.category ?? "—"}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-zinc-500 tabular-nums">
                  {e.occurrences}
                </td>
                <td className="px-6 py-3 text-zinc-500">
                  {teamDomain && e.first_seen_channel_id && e.first_seen_ts ? (
                    <a
                      href={`https://${teamDomain}.slack.com/archives/${e.first_seen_channel_id}/p${e.first_seen_ts.replace(".", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-900"
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
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
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
