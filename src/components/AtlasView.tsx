"use client";
import { useState } from "react";
import type { Channel } from "@/lib/db";
import { ChannelList } from "./ChannelList";
import { ChannelGraph } from "./ChannelGraph";

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

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-2 flex items-center gap-2 border-b border-zinc-800">
        <span className="text-xs uppercase tracking-wider text-zinc-500 mr-2">View</span>
        <button
          onClick={() => setView("list")}
          className={`px-3 py-1 rounded-md text-xs ${
            view === "list" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📋 List
        </button>
        <button
          onClick={() => setView("graph")}
          className={`px-3 py-1 rounded-md text-xs ${
            view === "graph" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🗺 Graph
        </button>
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
