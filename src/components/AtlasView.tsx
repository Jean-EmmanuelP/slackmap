"use client";
import { useState } from "react";
import type { Channel } from "@/lib/db";
import { ChannelList } from "./ChannelList";
import { ChannelGraph } from "./ChannelGraph";
import { AnthropicKeyButton } from "./AnthropicKeyButton";
import { FreshdeskConnectButton } from "./FreshdeskConnectButton";

// Atlas can be displayed as a list (default — better for B2B with rich per-row info)
// or a graph (visual overview, useful for first impression / pitch demos).
export function AtlasView({
  channels,
  teamDomain,
  workspaceId,
}: {
  channels: Channel[];
  teamDomain: string | null;
  workspaceId: string;
}) {
  const [view, setView] = useState<"list" | "graph">("list");
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
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-200 flex-wrap">
        <button
          onClick={mineAllPublic}
          disabled={busy}
          className="text-[11px] font-[var(--font-mono)] uppercase tracking-wider px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Queueing…" : "Mine all public channels"}
        </button>
        <span className="text-xs text-zinc-500">
          Click any channel to mine it individually.
        </span>
        {result && <span className="text-xs text-zinc-700 font-[var(--font-mono)]">{result}</span>}
        <div className="ml-auto flex items-center gap-3">
          <FreshdeskConnectButton workspaceId={workspaceId} />
          <AnthropicKeyButton workspaceId={workspaceId} />
          <div className="flex border border-zinc-300">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors ${
                view === "list"
                  ? "bg-zinc-900 text-[var(--paper)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView("graph")}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] border-l border-zinc-300 transition-colors ${
                view === "graph"
                  ? "bg-zinc-900 text-[var(--paper)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              Graph
            </button>
          </div>
        </div>
      </div>
      {view === "list" ? (
        <ChannelList channels={channels} workspaceId={workspaceId} teamDomain={teamDomain} />
      ) : (
        <div className="flex-1 min-h-[600px] flex">
          <ChannelGraph channels={channels} workspaceId={workspaceId} teamDomain={teamDomain} />
        </div>
      )}
    </div>
  );
}
