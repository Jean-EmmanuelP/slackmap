"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Channel } from "@/lib/db";

const CATEGORY_COLORS: Record<string, string> = {
  eng: "#3b82f6",
  product: "#8b5cf6",
  ops: "#f59e0b",
  support: "#10b981",
  sales: "#ec4899",
  social: "#06b6d4",
  announcements: "#ef4444",
  other: "#71717a",
};

// Lay channels out in a circle, grouped by category. Simple, deterministic,
// reads well at a glance. (We can swap for a force-directed layout in v1.)
function layoutCircular(channels: Channel[]): Node[] {
  const byCat = new Map<string, Channel[]>();
  for (const c of channels) {
    const cat = c.category || "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(c);
  }
  const cats = Array.from(byCat.keys()).sort();
  const nodes: Node[] = [];
  const radius = 480;
  const centerX = 600;
  const centerY = 400;

  cats.forEach((cat, i) => {
    const items = byCat.get(cat)!.sort((a, b) => b.message_count_6mo - a.message_count_6mo);
    const angleBase = (i / cats.length) * 2 * Math.PI;
    const arc = (2 * Math.PI) / cats.length;
    items.forEach((ch, j) => {
      const t = items.length === 1 ? 0.5 : j / (items.length - 1);
      const angle = angleBase + arc * (t - 0.5) * 0.85;
      const r = radius + (j % 3) * 60;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      const size = Math.max(40, Math.min(120, 40 + Math.log10(ch.message_count_6mo + 1) * 20));
      const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other;
      nodes.push({
        id: ch.id,
        position: { x, y },
        data: { label: `#${ch.name}`, channel: ch },
        style: {
          background: color,
          color: "#fff",
          borderRadius: 999,
          width: size,
          height: size,
          fontSize: Math.max(9, Math.min(13, size / 8)),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          textAlign: "center",
          border: "2px solid rgba(255,255,255,0.2)",
        },
      });
    });
  });
  return nodes;
}

export function ChannelGraph({
  channels,
  teamDomain,
  workspaceId,
}: {
  channels: Channel[];
  teamDomain: string | null;
  workspaceId: string;
}) {
  const initialNodes = useMemo(() => layoutCircular(channels.filter((c) => !c.archived)), [channels]);
  const edges: Edge[] = [];
  const [selected, setSelected] = useState<Channel | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelected((node.data?.channel as Channel) ?? null);
  }, []);

  const cats = Array.from(new Set(channels.map((c) => c.category || "other"))).sort();

  return (
    <div className="flex-1 flex relative">
      <ReactFlowProvider>
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={initialNodes}
            edges={edges}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.3}
            maxZoom={2}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </ReactFlowProvider>

      <div className="absolute top-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-md p-3 text-xs flex flex-col gap-1">
        {cats.map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ background: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other }}
            />
            <span className="text-zinc-300">{cat}</span>
          </div>
        ))}
      </div>

      {selected && (
        <ChannelPanel
          channel={selected}
          teamDomain={teamDomain}
          workspaceId={workspaceId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ChannelPanel({
  channel,
  teamDomain,
  workspaceId,
  onClose,
}: {
  channel: Channel;
  teamDomain: string | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const slackLink = teamDomain
    ? `https://${teamDomain}.slack.com/archives/${channel.slack_channel_id}`
    : null;

  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(channel.mining_status);
  const isMining = localStatus === "queued" || localStatus === "running";
  const isMined = localStatus === "done";

  async function trigger() {
    setBusy(true);
    setLocalStatus("queued");
    await fetch(`/api/workspace/${workspaceId}/channels/${channel.id}/mine`, { method: "POST" });
    setBusy(false);
    // refresh page state in 2s so user sees movement
    setTimeout(() => window.location.reload(), 2000);
  }

  return (
    <aside className="absolute top-0 right-0 h-full w-96 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
      >
        ✕
      </button>
      <h2 className="text-xl font-semibold text-zinc-100">
        {channel.is_private ? "🔒" : "#"}
        {channel.name}
      </h2>
      <div className="flex items-center gap-2 mt-1">
        {channel.category && (
          <span className="text-xs uppercase tracking-wide text-zinc-500">{channel.category}</span>
        )}
        <MiningBadge status={localStatus} />
      </div>

      <section className="mt-4">
        <button
          onClick={trigger}
          disabled={busy || isMining}
          className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isMining
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-wait"
              : isMined
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
              : "bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
          }`}
        >
          {isMining ? "Mining…" : isMined ? "Re-mine this channel" : "Mine this channel"}
        </button>
        {channel.is_private && localStatus === "failed" && (
          <p className="mt-2 text-xs text-amber-400">
            Private channel: you must `/invite @Slackmap` from inside the channel before mining.
          </p>
        )}
        {channel.mining_error && (
          <p className="mt-2 text-xs text-rose-400">Last error: {channel.mining_error}</p>
        )}
      </section>

      <section className="mt-4 space-y-1">
        <h3 className="text-xs uppercase text-zinc-500">Purpose</h3>
        <p className="text-sm text-zinc-200">
          {channel.purpose_extracted ?? channel.purpose_native ?? "— Mine to extract"}
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Messages (6mo)" value={channel.message_count_6mo.toLocaleString()} />
        <Stat label="Contributors" value={channel.unique_contributors.toString()} />
      </section>

      <section className="mt-4">
        <h3 className="text-xs uppercase text-zinc-500">Last activity</h3>
        <p className="text-sm text-zinc-300">
          {channel.last_message_at
            ? new Date(channel.last_message_at).toLocaleString()
            : "—"}
        </p>
      </section>

      {slackLink && (
        <a
          href={slackLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          Open in Slack →
        </a>
      )}
    </aside>
  );
}

function MiningBadge({ status }: { status: Channel["mining_status"] }) {
  const map: Record<Channel["mining_status"], { label: string; cls: string }> = {
    idle: { label: "not mined", cls: "bg-zinc-800 text-zinc-400" },
    queued: { label: "queued", cls: "bg-amber-500/15 text-amber-300" },
    running: { label: "mining…", cls: "bg-amber-500/25 text-amber-300" },
    done: { label: "mined", cls: "bg-emerald-500/15 text-emerald-300" },
    failed: { label: "failed", cls: "bg-rose-500/15 text-rose-300" },
  };
  const m = map[status] ?? map.idle;
  return <span className={`text-xs px-2 py-0.5 rounded-md ${m.cls}`}>{m.label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-md p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-medium text-zinc-100 mt-1">{value}</p>
    </div>
  );
}
