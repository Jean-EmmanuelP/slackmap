"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n-ui";

type Signal = {
  id: string;
  ticket_id: number;
  ticket_subject: string;
  ticket_url: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  category: string;
  reason: string;
  matched_skill_slug: string | null;
  matched_skill_confidence: number | null;
  status: "new" | "acknowledged" | "resolved" | "dismissed";
  created_at: string;
  requester_email: string | null;
  ticket_created_at: string | null;
};

type WindowChoice = "1" | "2" | "7" | "30";
const WINDOW_KEYS: Record<WindowChoice, string> = {
  "1": "fdSignals.window.1",
  "2": "fdSignals.window.2",
  "7": "fdSignals.window.7",
  "30": "fdSignals.window.30",
};

// Visible signal cap — hard limit so the panel never becomes a wall of text.
// "Show all" expands within the window; if you want more, widen the window.
const VISIBLE_CAP = 20;

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

const URGENCY_STYLES: Record<Signal["urgency"], string> = {
  critical: "border-red-500 bg-red-50 text-red-900",
  high: "border-orange-400 bg-orange-50 text-orange-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  complaint: "Complaint",
  bug: "Bug",
  unknown_intent: "New pattern",
  sentiment_negative: "Frustrated",
  spike: "Spike",
  churn_risk: "Churn risk",
  other: "Other",
};

export function FreshdeskSignalsPanel({
  workspaceId,
  freshdeskConnected,
  lang,
}: {
  workspaceId: string;
  freshdeskConnected: boolean;
  lang?: string;
}) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [windowChoice, setWindowChoice] = useState<WindowChoice>("7");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowAll(false);
    try {
      const res = await fetch(
        `/api/workspace/${workspaceId}/freshdesk/signals?status=new,acknowledged&sinceDays=${windowChoice}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setSignals((json.items ?? []) as Signal[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, windowChoice]);

  useEffect(() => {
    if (freshdeskConnected) void load();
    else setLoading(false);
  }, [freshdeskConnected, load]);

  async function runScan() {
    setScanning(true);
    setError(null);
    setScanSummary(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/freshdesk/analyze?limit=50`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `${res.status}`);
      }
      const json = await res.json();
      const counts = json.byUrgency ?? {};
      const summary = `Analyzed ${json.analyzed} tickets · ${json.signals} signals` +
        (counts.critical ? ` · ${counts.critical} critical` : "") +
        (counts.high ? ` · ${counts.high} high` : "");
      setScanSummary(summary);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function setStatus(signalId: string, status: Signal["status"]) {
    setSignals((prev) => prev.filter((s) => s.id !== signalId));
    try {
      await fetch(`/api/workspace/${workspaceId}/freshdesk/signals/${signalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // Roll back on failure — re-fetch
      void load();
    }
  }

  if (!freshdeskConnected) return null;

  // Sort by urgency severity, then created date.
  const sortedSignals = [...signals].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
    return b.created_at.localeCompare(a.created_at);
  });

  const criticalCount = signals.filter((s) => s.urgency === "critical").length;
  const highCount = signals.filter((s) => s.urgency === "high").length;

  // Brain-derived framing: count distinct requesters in window, churn signals,
  // unmatched-intent signals. Not Freshdesk's "X open tickets" — those are
  // deliberately omitted (Freshdesk owns that view).
  const distinctRequesters = new Set(signals.map((s) => s.requester_email).filter(Boolean)).size;
  const churnRisk = signals.filter((s) => s.category === "churn_risk").length;
  const unmatchedIntents = signals.filter((s) => s.category === "unknown_intent").length;
  // Some signals predate the requester_email column → hide noise if 0.
  const hasRequesterData = signals.some((s) => s.requester_email !== null);

  const visibleSignals = showAll ? sortedSignals : sortedSignals.slice(0, VISIBLE_CAP);
  const hiddenCount = sortedSignals.length - visibleSignals.length;

  return (
    <section className="col-span-12 border border-zinc-200 p-5">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {t("fdSignals.title", lang)}
            </div>
            {(criticalCount > 0 || highCount > 0) && (
              <div className="flex items-center gap-1.5">
                {criticalCount > 0 && (
                  <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border border-red-500 bg-red-50 text-red-900">
                    {criticalCount} critical
                  </span>
                )}
                {highCount > 0 && (
                  <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border border-orange-400 bg-orange-50 text-orange-900">
                    {highCount} high
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{t("fdSignals.subtitle", lang)}</p>
          {signals.length > 0 && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {signals.length} signals
              {hasRequesterData && ` · ${distinctRequesters} distinct customers`}
              {churnRisk > 0 && ` · ${churnRisk} churn-risk`}
              {unmatchedIntents > 0 && ` · ${unmatchedIntents} new pattern${unmatchedIntents > 1 ? "s" : ""}`}
              {!hasRequesterData && ` · re-run scan to enrich with customer data`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
        >
          {scanning ? t("fdSignals.scanning", lang) : t("fdSignals.runScan", lang)}
        </button>
      </div>

      {/* Time-window filter — the brain reasons in windows, not pages. */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {(Object.keys(WINDOW_KEYS) as WindowChoice[]).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindowChoice(w)}
            className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border transition-colors ${
              windowChoice === w
                ? "bg-zinc-900 text-[var(--paper)] border-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-900"
            }`}
          >
            {t(WINDOW_KEYS[w], lang)}
          </button>
        ))}
      </div>

      {scanSummary && (
        <p className="mb-3 text-xs text-zinc-700 font-[var(--font-mono)]">{scanSummary}</p>
      )}
      {error && <p className="mb-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}

      {loading ? (
        <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">Loading…</p>
      ) : sortedSignals.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("fdSignals.noSignals", lang)}</p>
      ) : (
        <>
          <ul className="divide-y divide-zinc-100">
            {visibleSignals.map((s) => (
              <SignalRow
                key={s.id}
                signal={s}
                onAcknowledge={() => setStatus(s.id, "acknowledged")}
                onDismiss={() => setStatus(s.id, "dismissed")}
                onResolve={() => setStatus(s.id, "resolved")}
              />
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 w-full text-[10px] uppercase tracking-wider font-[var(--font-mono)] py-2 border border-zinc-200 hover:border-zinc-900 text-zinc-700 hover:text-zinc-900"
            >
              Show {hiddenCount} more in this window
            </button>
          )}
          {showAll && sortedSignals.length > VISIBLE_CAP && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-3 w-full text-[10px] uppercase tracking-wider font-[var(--font-mono)] py-2 text-zinc-500 hover:text-zinc-900"
            >
              Collapse to top {VISIBLE_CAP}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function SignalRow({
  signal,
  onAcknowledge,
  onDismiss,
  onResolve,
}: {
  signal: Signal;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onResolve: () => void;
}) {
  return (
    <li className="py-3 flex items-start gap-3">
      <span
        className={`shrink-0 text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border ${URGENCY_STYLES[signal.urgency]}`}
      >
        {signal.urgency}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {signal.ticket_url ? (
            <a
              href={signal.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-900 hover:underline truncate"
            >
              #{signal.ticket_id} · {signal.ticket_subject}
            </a>
          ) : (
            <span className="text-sm text-zinc-900 truncate">
              #{signal.ticket_id} · {signal.ticket_subject}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {CATEGORY_LABELS[signal.category] ?? signal.category}
          </span>
          {signal.matched_skill_slug && (
            <span
              className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-700"
              title={`Matches skill: ${signal.matched_skill_slug}`}
            >
              ↳ skill match
            </span>
          )}
          {signal.status === "acknowledged" && (
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
              ack
            </span>
          )}
        </div>
        {/* WHO + WHEN — minimal context the brain needs, not Freshdesk metadata */}
        {(signal.requester_email || signal.ticket_created_at) && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 flex items-center gap-2 flex-wrap">
            {signal.requester_email && (
              <span className="lowercase tracking-normal text-zinc-500" title={signal.requester_email}>
                {signal.requester_email}
              </span>
            )}
            {signal.ticket_created_at && (
              <span title={new Date(signal.ticket_created_at).toLocaleString()}>
                {formatRelative(signal.ticket_created_at)}
              </span>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{signal.reason}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        {signal.status === "new" && (
          <button
            type="button"
            onClick={onAcknowledge}
            className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 hover:border-zinc-900 text-zinc-700 hover:text-zinc-900"
          >
            Ack
          </button>
        )}
        <button
          type="button"
          onClick={onResolve}
          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-emerald-300 hover:border-emerald-700 text-emerald-700 hover:text-emerald-800"
        >
          Resolved
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 text-zinc-400 hover:text-red-700"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}
