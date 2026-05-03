"use client";
import { useEffect, useState } from "react";

type State = {
  connected: boolean;
  domain: string | null;
  status: "idle" | "queued" | "running" | "done" | "failed";
  error: string | null;
  lastRunAt: string | null;
  skillsCount: number;
  glossaryCount: number;
};

const MONO_LABEL =
  "text-[10px] uppercase tracking-[0.18em] font-[var(--font-mono)] text-zinc-500";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffMo = Math.round(diffD / 30);
  return `${diffMo}mo ago`;
}

export function FreshdeskConnectButton({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/workspace/${workspaceId}/freshdesk`);
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    refresh().catch(() =>
      setState({
        connected: false,
        domain: null,
        status: "idle",
        error: null,
        lastRunAt: null,
        skillsCount: 0,
        glossaryCount: 0,
      }),
    );
  }, [workspaceId]);

  // Poll while running so user sees status flip to done.
  useEffect(() => {
    if (state?.status !== "running" && state?.status !== "queued") return;
    const t = setInterval(() => refresh(), 5000);
    return () => clearInterval(t);
  }, [state?.status]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/freshdesk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), apiKey: apiKey.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "connect_failed");
        return;
      }
      setApiKey("");
      setOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch(`/api/workspace/${workspaceId}/freshdesk`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const dotColor = (() => {
    if (!state) return "bg-zinc-300";
    if (state.status === "running" || state.status === "queued")
      return "bg-amber-500 animate-pulse";
    if (state.status === "done") return "bg-emerald-500";
    if (state.status === "failed") return "bg-rose-500";
    return state.connected ? "bg-emerald-500" : "bg-zinc-300";
  })();

  // Inline label: "done · 2h ago · 24 skills"
  const inlineSummary = (() => {
    if (!state || !state.connected) return null;
    const parts: string[] = [state.status];
    if (state.status === "done" && state.lastRunAt) {
      parts.push(relativeTime(state.lastRunAt));
    }
    if (state.skillsCount > 0) parts.push(`${state.skillsCount} skill${state.skillsCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  })();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 border border-zinc-300 hover:border-zinc-500 inline-flex items-center gap-2 bg-[var(--paper)]"
      >
        <span className={`size-1.5 ${dotColor}`} />
        <span>Freshdesk</span>
        {inlineSummary && (
          <span className="text-[10px] text-zinc-500 normal-case font-[var(--font-mono)]">
            {inlineSummary}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-2 w-[28rem] border border-zinc-300 bg-[var(--paper)] shadow-md p-4">
          <div className="text-sm font-medium text-zinc-900 mb-1">
            {state?.connected ? "Freshdesk connected" : "Connect Freshdesk"}
          </div>
          <div className="text-xs text-zinc-600 mb-3 leading-relaxed">
            Pulls solution articles + recent tickets, extracts skills (refund policy,
            triage rules, escalation paths) and adds them to your brain.
          </div>
          {state?.connected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className={MONO_LABEL}>Domain</div>
                  <div className="text-xs font-mono text-zinc-900 truncate">{state.domain}</div>
                </div>
                <div>
                  <div className={MONO_LABEL}>Status</div>
                  <div className="text-xs text-zinc-900">
                    {state.status}
                    {state.error && (
                      <span className="text-rose-700"> — {state.error}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className={MONO_LABEL}>Last run</div>
                  <div className="text-xs text-zinc-900">{relativeTime(state.lastRunAt)}</div>
                </div>
                <div>
                  <div className={MONO_LABEL}>Extracted</div>
                  <div className="text-xs text-zinc-900">
                    {state.skillsCount} skill{state.skillsCount === 1 ? "" : "s"} ·{" "}
                    {state.glossaryCount} term{state.glossaryCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-300"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.freshdesk.com"
                className="w-full px-3 py-2 text-sm border border-zinc-300 bg-[var(--paper)] focus:outline-none focus:border-[#5170ff]"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API key (Profile Settings → View API Key)"
                className="w-full px-3 py-2 text-sm border border-zinc-300 bg-[var(--paper)] focus:outline-none focus:border-[#5170ff]"
              />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                We pull solution articles + last 100 tickets. Read-only. Decrypt locally
                only.
              </p>
              {error && <div className="text-xs text-rose-700">{error}</div>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={connect}
                  disabled={busy || !domain.trim() || !apiKey.trim()}
                  className="text-xs font-medium px-3 py-1.5 bg-[#5170ff] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Connecting…" : "Connect & extract"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
