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
          className="text-xs font-medium px-4 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Queueing…" : "Mine all public channels"}
        </button>
        <span className="text-xs text-zinc-500">
          Click any channel to mine it individually. Private channels read with
          your user identity (silent).
        </span>
        {result && <span className="text-xs text-emerald-700">{result}</span>}
        <div className="ml-auto flex items-center gap-3">
          <FreshdeskConnectButton workspaceId={workspaceId} />
          <AnthropicKeyButton workspaceId={workspaceId} />
        <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-0.5">
          <button
            onClick={() => setView("list")}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors ${
              view === "list"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("graph")}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors ${
              view === "graph"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900"
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
        <div className="flex-1 min-h-[600px] flex bg-white">
          <ChannelGraph channels={channels} workspaceId={workspaceId} teamDomain={teamDomain} />
        </div>
      )}
    </div>
  );
}
