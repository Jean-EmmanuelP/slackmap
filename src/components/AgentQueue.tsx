"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/db";

const URGENCY_STYLES: Record<NonNullable<AgentRun["urgency"]>, string> = {
  critical: "border-red-500 bg-red-50 text-red-900",
  high: "border-orange-400 bg-orange-50 text-orange-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

const URGENCY_RANK: Record<NonNullable<AgentRun["urgency"]>, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function AgentQueue({
  workspaceId,
  runs,
  currentStatus,
  freshdeskConnected,
}: {
  workspaceId: string;
  runs: AgentRun[];
  currentStatus: AgentRun["status"];
  freshdeskConnected: boolean;
  lang?: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/agent/tick`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setScanResult(`error: ${body.error ?? res.status}`);
      } else {
        setScanResult("Scan queued — refresh in 30s for new drafts");
      }
    } finally {
      setScanning(false);
    }
  }

  const sorted = [...runs].sort((a, b) => {
    const ar = a.urgency ? URGENCY_RANK[a.urgency] : 9;
    const br = b.urgency ? URGENCY_RANK[b.urgency] : 9;
    if (ar !== br) return ar - br;
    return (b.ticket_created_at ?? "").localeCompare(a.ticket_created_at ?? "");
  });

  const pending = runs.length;
  const distinctRequesters = new Set(runs.map((r) => r.requester_email).filter(Boolean)).size;
  const critical = runs.filter((r) => r.urgency === "critical").length;
  const high = runs.filter((r) => r.urgency === "high").length;

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900">Agent</h1>
          <p className="mt-1 text-sm text-zinc-500 max-w-2xl">
            Drafts the AI prepared for the support queue. Review, edit, send — every send
            teaches the brain whether the draft was on point.
          </p>
          {pending > 0 && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {pending} drafts · {distinctRequesters} distinct customers
              {critical > 0 && ` · ${critical} critical`}
              {high > 0 && ` · ${high} high`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runScan}
            disabled={scanning || !freshdeskConnected}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
            title={freshdeskConnected ? undefined : "Connect Freshdesk first"}
          >
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
      </div>
      {scanResult && (
        <p className="mt-2 text-xs text-zinc-700 font-[var(--font-mono)]">{scanResult}</p>
      )}

      {/* Status filter */}
      <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wider font-[var(--font-mono)]">
        {(["pending", "sent", "rejected", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/agent?ws=${workspaceId}&status=${s}`}
            className={`px-2 py-1 border ${
              currentStatus === s || (s === "all" && currentStatus !== "pending" && currentStatus !== "sent" && currentStatus !== "rejected")
                ? "bg-zinc-900 text-[var(--paper)] border-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-900"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Queue */}
      <div className="mt-6 border border-zinc-200">
        {sorted.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            No drafts in this view. Hit{" "}
            <span className="font-[var(--font-mono)]">Scan now</span> to process new tickets.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sorted.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/agent/${r.id}?ws=${workspaceId}`}
                  className="flex items-start gap-3 py-3 px-5 hover:bg-zinc-50"
                >
                  <span
                    className={`shrink-0 mt-0.5 text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border ${URGENCY_STYLES[r.urgency ?? "low"]}`}
                  >
                    {r.urgency ?? "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-zinc-900 truncate">
                        #{r.ticket_id} · {r.ticket_subject}
                      </span>
                      {r.category && (
                        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
                          {r.category}
                        </span>
                      )}
                      {r.matched_skill_slugs.length > 0 && (
                        <span
                          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-700"
                          title={r.matched_skill_slugs.join(", ")}
                        >
                          ↳ {r.matched_skill_slugs.length} skills
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 flex items-center gap-2 flex-wrap">
                      {r.requester_email && (
                        <span className="lowercase tracking-normal text-zinc-500">{r.requester_email}</span>
                      )}
                      {r.ticket_created_at && <span>{formatRelative(r.ticket_created_at)}</span>}
                    </div>
                    {r.draft_original && (
                      <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{r.draft_original}</p>
                    )}
                  </div>
                  <span className="shrink-0 self-center text-zinc-400 text-xs">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
