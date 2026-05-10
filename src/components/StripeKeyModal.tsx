"use client";

import { useState } from "react";

// Modal that lets the user paste a Stripe secret key. Validates by hitting
// /api/workspace/[id]/stripe/key which itself pings Stripe's /v1/account
// before persisting. On success, refreshes the page so the chip flips to
// "Connected".
export function StripeKeyModal({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ accountId: string; livemode: boolean } | null>(null);

  if (!open) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/stripe/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail ?? body.error ?? `${res.status}`);
      setSuccess({ accountId: body.accountId, livemode: !!body.livemode });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-[480px] max-w-full bg-[var(--paper)] border border-zinc-300 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-zinc-900">Connect Stripe</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-zinc-500 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed mb-4">
          Paste your Stripe secret key (<span className="font-[var(--font-mono)]">sk_live_…</span> or{" "}
          <span className="font-[var(--font-mono)]">sk_test_…</span>). The agent will use it to look up
          customers, validate subscriptions and process refunds tied to support tickets.
        </p>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            Stripe secret key
          </span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk_live_..."
            disabled={busy || !!success}
            className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-[var(--font-mono)] focus:outline-none focus:border-zinc-900 disabled:opacity-60"
          />
        </label>
        {error && <p className="mt-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}
        {success && (
          <p className="mt-3 text-xs text-emerald-700 font-[var(--font-mono)]">
            Connected to {success.accountId} ({success.livemode ? "live mode" : "test mode"}). Refreshing…
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-600 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !keyInput.trim() || !!success}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Save & connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
