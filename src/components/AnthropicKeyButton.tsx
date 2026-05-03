"use client";
import { useEffect, useState } from "react";

export function AnthropicKeyButton({ workspaceId }: { workspaceId: string }) {
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workspace/${workspaceId}/anthropic-key`)
      .then((r) => r.json())
      .then((d) => setKeySet(!!d.keySet))
      .catch(() => setKeySet(false));
  }, [workspaceId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/anthropic-key`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "save_failed");
        return;
      }
      setKeySet(true);
      setValue("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/workspace/${workspaceId}/anthropic-key`, { method: "DELETE" });
      setKeySet(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 inline-flex items-center gap-2"
      >
        <span
          className={`size-1.5 rounded-full ${
            keySet === null ? "bg-zinc-300" : keySet ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        Anthropic key
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-2 w-96 rounded-xl border border-zinc-200 bg-white shadow-xl p-4">
          <div className="text-sm font-medium text-zinc-900 mb-1">Anthropic API key</div>
          <div className="text-xs text-zinc-500 mb-3">
            Used for skills + people extraction. Stored encrypted at rest.{" "}
            <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              Get one
            </a>
            .
          </div>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={save}
              disabled={busy || !value.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save key"}
            </button>
            {keySet && (
              <button
                onClick={remove}
                disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full text-rose-600 hover:bg-rose-50"
              >
                Remove current key
              </button>
            )}
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
  );
}
