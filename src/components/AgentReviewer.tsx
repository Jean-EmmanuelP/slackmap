"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/db";

type ProposedAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  stage: "communication" | "remediation" | "housekeeping" | "memory" | "escalation";
  irreversible: boolean;
  approval: "low" | "medium" | "high";
};

export function AgentReviewer({
  workspaceId,
  run,
}: {
  workspaceId: string;
  run: AgentRun;
  lang?: string;
}) {
  const [draft, setDraft] = useState(run.draft_original ?? "");
  const [busy, setBusy] = useState<null | "send" | "reject" | "redraft">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const isPending = run.status === "pending";
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;

  const proposedActions = Array.isArray(run.proposed_actions)
    ? (run.proposed_actions as unknown as ProposedAction[])
    : [];

  const alreadyApplied = new Set(
    Array.isArray(run.applied_actions) ? (run.applied_actions as string[]) : [],
  );

  // Auto-pre-check actions that are LOW risk (so Marc just confirms in 1 click).
  // High-risk irreversible stuff stays unchecked — explicit consent only.
  const [approved, setApproved] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const a of proposedActions) {
      if (alreadyApplied.has(a.id)) continue;
      if (a.approval === "low") s.add(a.id);
      // freshdesk.reply is medium but expected; keep auto-checked for convenience
      if (a.tool === "freshdesk.reply") s.add(a.id);
    }
    return s;
  });

  const [executing, setExecuting] = useState(false);
  const [execResults, setExecResults] = useState<
    Array<{ actionId: string; tool: string; status: string; message: string }> | null
  >(null);

  function toggleApprove(id: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function executeApproved() {
    if (approved.size === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/${workspaceId}/agent/runs/${run.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvedActionIds: Array.from(approved) }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setExecResults(body.results ?? []);
      // Refresh server state after a brief delay so the user sees results first
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setExecuting(false);
    }
  }

  async function redraft() {
    setBusy("redraft");
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/agent/runs/${run.id}/redraft`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail ?? body.error ?? `${res.status}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-draft failed");
    } finally {
      setBusy(null);
    }
  }

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

          {/* === PROPOSED ACTION PLAN ===========================
            * What the agent thinks SHOULD happen on this ticket — beyond
            * just sending the reply text. Multi-tool plan across Freshdesk
            * (status, tags, notes), Stripe (refund, cancel sub), Slack
            * (notify bug-support — exec locked), and DB (customer memory).
            *
            * Phase 1+2: visible only, NOT executed. The text reply still
            * flows through "Send to customer" above. Phase 3 will add a
            * second "Execute approved actions" button when ready.
            * =================================================*/}
          <section className="mt-8 pt-6 border-t-2 border-zinc-200">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                  Proposed action plan
                </div>
                <div className="mt-0.5 text-sm font-medium text-zinc-900">
                  {proposedActions.length === 0 ? (
                    "No actions proposed for this ticket"
                  ) : (
                    <>
                      {proposedActions.length} action{proposedActions.length > 1 ? "s" : ""}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        · phase 2 · visible only, not executed
                      </span>
                    </>
                  )}
                </div>
              </div>
              {isPending && (
                <button
                  type="button"
                  onClick={redraft}
                  disabled={busy !== null}
                  className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  title="Force re-generation of the draft + action plan with the latest prompt + context"
                >
                  {busy === "redraft" ? "Re-drafting…" : "Re-draft with new prompt"}
                </button>
              )}
            </div>

            {proposedActions.length > 0 && (
              <>
                <ul className="mt-3 space-y-2">
                  {proposedActions.map((a) => (
                    <ActionRow
                      key={a.id}
                      action={a}
                      checked={approved.has(a.id)}
                      applied={alreadyApplied.has(a.id)}
                      onToggle={() => toggleApprove(a.id)}
                      disabled={executing || !isPending || alreadyApplied.has(a.id)}
                    />
                  ))}
                </ul>

                {isPending && (
                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
                      {approved.size} of {proposedActions.length} action
                      {proposedActions.length > 1 ? "s" : ""} approved
                    </span>
                    <button
                      type="button"
                      onClick={executeApproved}
                      disabled={executing || approved.size === 0}
                      className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-4 py-2 border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {executing
                        ? "Executing…"
                        : `Execute ${approved.size} approved action${approved.size === 1 ? "" : "s"} →`}
                    </button>
                  </div>
                )}

                {execResults && (
                  <div className="mt-4 border border-zinc-200 bg-zinc-50/50 p-3 text-xs space-y-1.5 font-[var(--font-mono)]">
                    <div className="uppercase tracking-wider text-zinc-500 text-[10px]">
                      Execution results
                    </div>
                    {execResults.map((r, i) => (
                      <div key={i} className="flex items-baseline gap-2 flex-wrap">
                        <span
                          className={
                            r.status === "executed"
                              ? "text-emerald-700"
                              : r.status === "blocked"
                                ? "text-amber-700"
                                : r.status === "skipped"
                                  ? "text-zinc-500"
                                  : "text-red-700"
                          }
                        >
                          {r.status === "executed"
                            ? "✓"
                            : r.status === "blocked"
                              ? "⊘"
                              : r.status === "skipped"
                                ? "·"
                                : "✗"}
                        </span>
                        <span className="text-zinc-900">{r.tool}</span>
                        <span className="text-zinc-500 text-[11px]">{r.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {proposedActions.length === 0 && isPending && (
              <p className="mt-2 text-xs text-zinc-500 italic max-w-xl leading-relaxed">
                This run was drafted before the action-plan feature shipped. Hit{" "}
                <span className="font-[var(--font-mono)]">Re-draft with new prompt</span>{" "}
                above to regenerate with the multi-tool plan (refund / cancel sub / record
                customer fact / etc. depending on the ticket).
              </p>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}

function ActionRow({
  action,
  checked,
  applied,
  onToggle,
  disabled,
}: {
  action: ProposedAction;
  checked: boolean;
  applied: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const stageColor =
    action.stage === "communication"
      ? "border-emerald-300 bg-emerald-50/30"
      : action.stage === "remediation"
        ? "border-orange-300 bg-orange-50/30"
        : action.stage === "memory"
          ? "border-indigo-200 bg-indigo-50/20"
          : action.stage === "escalation"
            ? "border-red-300 bg-red-50/30"
            : "border-zinc-200 bg-zinc-50/30";

  const pillarFromTool = action.tool.split(".")[0];
  const pillarColor =
    pillarFromTool === "freshdesk"
      ? "text-emerald-700"
      : pillarFromTool === "stripe"
        ? "text-indigo-700"
        : pillarFromTool === "slack"
          ? "text-purple-700"
          : "text-zinc-700";

  const approvalChip =
    action.approval === "high"
      ? "border-red-400 bg-red-50 text-red-800"
      : action.approval === "medium"
        ? "border-amber-400 bg-amber-50 text-amber-800"
        : "border-zinc-300 bg-zinc-50 text-zinc-600";

  return (
    <li className={`border ${stageColor} px-3 py-2 ${applied ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            disabled={disabled}
            className="mt-1 accent-emerald-700"
            aria-label={`Approve ${action.tool}`}
          />
          <span className={`text-sm font-medium font-[var(--font-mono)] ${pillarColor}`}>
            {action.tool}
            {applied && (
              <span className="ml-2 text-[9px] uppercase tracking-wider text-emerald-700">
                ✓ executed
              </span>
            )}
          </span>
          <span className="text-[9px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {action.stage}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border ${approvalChip}`}
          >
            {action.approval} approval
          </span>
          {action.irreversible && (
            <span className="text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border border-red-500 bg-red-50 text-red-800">
              IRREVERSIBLE
            </span>
          )}
        </div>
      </div>

      {action.reason && (
        <p className="mt-1 text-xs text-zinc-700 leading-snug">{action.reason}</p>
      )}

      {Object.keys(action.args).length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 cursor-pointer">
            Args
          </summary>
          <pre className="mt-1 text-[10px] font-[var(--font-mono)] text-zinc-600 leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(action.args, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
