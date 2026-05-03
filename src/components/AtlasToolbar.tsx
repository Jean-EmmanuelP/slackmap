"use client";
import { useState } from "react";

export function AtlasToolbar({ workspaceId }: { workspaceId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function mineAllPublic() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/mine-all-public`, { method: "POST" });
      const data = await res.json();
      setResult(`Queued ${data.queuedCount ?? 0} public channels`);
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setResult("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-3 bg-[var(--paper)]">
      <button
        onClick={mineAllPublic}
        disabled={busy}
        className="px-3 py-1.5 rounded-md text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
      >
        {busy ? "Queueing…" : "⛏ Mine all public channels"}
      </button>
      <span className="text-xs text-zinc-500">
        Click a channel to mine it individually. Private channels need to read with your user identity (silent).
      </span>
      {result && <span className="ml-auto text-xs text-emerald-700">{result}</span>}
    </div>
  );
}
