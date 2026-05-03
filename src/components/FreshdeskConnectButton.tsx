"use client";
import { useEffect, useState } from "react";

type State = {
  connected: boolean;
  domain: string | null;
  status: "idle" | "queued" | "running" | "done" | "failed";
  error: string | null;
};

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
    refresh().catch(() => setState({ connected: false, domain: null, status: "idle", error: null }));
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
    if (state.status === "running" || state.status === "queued") return "bg-amber-500 animate-pulse";
    if (state.status === "done") return "bg-emerald-500";
    if (state.status === "failed") return "bg-rose-500";
    return state.connected ? "bg-emerald-500" : "bg-zinc-300";
  })();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 inline-flex items-center gap-2"
      >
        <span className={`size-1.5 rounded-full ${dotColor}`} />
        Freshdesk
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-2 w-[26rem] rounded-xl border border-zinc-200 bg-white shadow-xl p-4">
          <div className="text-sm font-medium text-zinc-900 mb-1">
            {state?.connected ? "Freshdesk connected" : "Connect Freshdesk"}
          </div>
          <div className="text-xs text-zinc-500 mb-3">
            Pulls solution articles + recent tickets, extracts skills (refund policy,
            triage rules, escalation paths) and adds them to your brain.
          </div>
          {state?.connected ? (
            <div className="space-y-2">
              <div className="text-xs text-zinc-700">
                Domain: <span className="font-mono">{state.domain}</span>
              </div>
              <div className="text-xs text-zinc-700">
                Status: <span className="font-medium">{state.status}</span>
                {state.error && <span className="text-rose-600"> — {state.error}</span>}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 rounded-full text-rose-600 hover:bg-rose-50"
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
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API key (Profile Settings → View API Key)"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              {error && <div className="text-xs text-rose-600">{error}</div>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={connect}
                  disabled={busy || !domain.trim() || !apiKey.trim()}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
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
