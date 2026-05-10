"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/db";

export function AgentReviewer({
  workspaceId,
  run,
}: {
  workspaceId: string;
  run: AgentRun;
  lang?: string;
}) {
  const [draft, setDraft] = useState(run.draft_original ?? "");
  const [busy, setBusy] = useState<null | "send" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const isPending = run.status === "pending";
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;

  async function send() {
    if (!draft.trim()) {
      setError("Draft can't be empty");
      return;
    }
    setBusy("send");
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/agent/runs/${run.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail ?? body.error ?? `${res.status}`);
      setDone(`Sent · diff ${(body.diff_distance * 100).toFixed(0)}% from AI draft`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/agent/runs/${run.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `${res.status}`);
      }
      setDone("Rejected — won't be sent. The brain learned this pattern doesn't apply here.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
        <Link
          href={`/agent?ws=${workspaceId}`}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900"
        >
          ← Queue
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            #{run.ticket_id}
          </span>
          {run.urgency && (
            <span className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border ${
              run.urgency === "critical" ? "border-red-500 bg-red-50 text-red-900"
              : run.urgency === "high" ? "border-orange-400 bg-orange-50 text-orange-900"
              : run.urgency === "medium" ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-zinc-300 text-zinc-700"
            }`}>
              {run.urgency}
            </span>
          )}
          {run.category && (
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
              {run.category}
            </span>
          )}
          <span className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border ${
            run.status === "pending" ? "border-zinc-300 bg-zinc-50 text-zinc-700"
            : run.status === "sent" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : run.status === "rejected" ? "border-zinc-300 text-zinc-500"
            : "border-red-300 bg-red-50 text-red-700"
          }`}>
            {run.status}
          </span>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-200 overflow-hidden">
        {/* Left: ticket */}
        <section className="bg-[var(--paper)] p-6 overflow-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
            Ticket
          </div>
          <h2 className="text-xl font-medium text-zinc-900">{run.ticket_subject}</h2>
          <div className="mt-2 text-xs text-zinc-500 font-[var(--font-mono)]">
            {run.requester_email && <span className="lowercase">{run.requester_email}</span>}
            {run.ticket_created_at && (
              <span> · {new Date(run.ticket_created_at).toLocaleString()}</span>
            )}
            {run.ticket_url && (
              <>
                {" · "}
                <a href={run.ticket_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  open in Freshdesk ↗
                </a>
              </>
            )}
          </div>
          <pre className="mt-5 text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed">
            {run.ticket_body ?? "(no body)"}
          </pre>

          {/* Reasoning + skills */}
          <div className="mt-8 pt-5 border-t border-zinc-100">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
              Why the agent drafted this
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">{run.reasoning ?? "(no reasoning)"}</p>
            {run.matched_skill_slugs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {run.matched_skill_slugs.map((slug) => (
                  <Link
                    key={slug}
                    href={`/api/workspace/${workspaceId}/skills/${slug}`}
                    target="_blank"
                    className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border border-emerald-300 text-emerald-700 hover:border-emerald-700"
                  >
                    {slug}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: editor */}
        <section className="bg-[var(--paper)] p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              Reply (editable)
            </div>
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
              {wordCount} words
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!isPending || busy !== null}
            className="flex-1 min-h-[300px] border border-zinc-300 px-4 py-3 text-sm text-zinc-900 font-sans leading-relaxed resize-none focus:outline-none focus:border-zinc-900 disabled:opacity-60 disabled:bg-zinc-50"
            placeholder="(no draft — agent recommended human handling)"
          />
          {error && <p className="mt-2 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}
          {done && <p className="mt-2 text-xs text-emerald-700 font-[var(--font-mono)]">{done}</p>}

          {isPending && !done && (
            <>
              {showRejectInput && (
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why reject? (optional — feeds the brain)"
                  className="mt-3 px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-900"
                />
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                {!showRejectInput ? (
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-red-700"
                  >
                    Reject
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reject}
                    disabled={busy !== null}
                    className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-red-700 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy === "reject" ? "Rejecting…" : "Confirm reject"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={busy !== null || !draft.trim()}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy === "send" ? "Sending…" : "Send to customer →"}
                </button>
              </div>
            </>
          )}

          {!isPending && (
            <div className="mt-4 text-xs text-zinc-500 leading-relaxed">
              {run.status === "sent" && (
                <>
                  Sent {run.sent_at && new Date(run.sent_at).toLocaleString()}.
                  {run.outcome === "sent_unchanged" && " Draft used as-is — high-trust signal for the matched skills."}
                  {run.outcome === "sent_edited" && run.diff_distance != null && (
                    <> Edited by ~{(run.diff_distance * 100).toFixed(0)}% before sending.</>
                  )}
                </>
              )}
              {run.status === "rejected" && (
                <>Rejected{run.rejection_reason ? `: ${run.rejection_reason}` : ""}.</>
              )}
              {run.status === "failed" && (
                <>Send failed: {run.rejection_reason ?? "unknown error"}.</>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
