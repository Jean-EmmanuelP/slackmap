"use client";

import { useMemo, useState } from "react";
import type { Channel } from "@/lib/db";
import { RelTime } from "./RelTime";

const STATUS_STYLES: Record<Channel["mining_status"], string> = {
  idle: "bg-zinc-100 text-zinc-500",
  queued: "bg-amber-50 text-amber-700 border border-amber-200",
  running: "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border border-rose-200",
};

export function ChannelList({
  channels,
  workspaceId,
  teamDomain,
}: {
  channels: Channel[];
  workspaceId: string;
  teamDomain: string | null;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Channel["mining_status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "public" | "private">("all");
  const [selected, setSelected] = useState<Channel | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return channels
      .filter((c) => !c.archived)
      .filter((c) => statusFilter === "all" || c.mining_status === statusFilter)
      .filter((c) =>
        typeFilter === "all"
          ? true
          : typeFilter === "private"
          ? c.is_private
          : !c.is_private,
      )
      .filter((c) => {
        if (!ql) return true;
        return (
          c.name.toLowerCase().includes(ql) ||
          (c.purpose_extracted?.toLowerCase().includes(ql) ?? false) ||
          (c.category?.toLowerCase().includes(ql) ?? false)
        );
      })
      .sort((a, b) => b.message_count_6mo - a.message_count_6mo);
  }, [channels, q, statusFilter, typeFilter]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-200 flex-wrap">
        <input
          type="search"
          placeholder="Search channels…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 rounded-md bg-white border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
        />
        <FilterChips
          options={[
            { value: "all", label: "all" },
            { value: "public", label: "public" },
            { value: "private", label: "🔒 private" },
          ]}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as typeof typeFilter)}
        />
        <FilterChips
          options={[
            { value: "all", label: "all" },
            { value: "done", label: "mined" },
            { value: "running", label: "mining" },
            { value: "queued", label: "queued" },
            { value: "idle", label: "not mined" },
            { value: "failed", label: "failed" },
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as typeof statusFilter)}
        />
        <span className="ml-auto text-xs text-zinc-500">{filtered.length} channels</span>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0 z-10 border-b border-zinc-200">
            <tr className="text-left text-xs uppercase text-zinc-500">
              <th className="px-6 py-3 font-medium">Channel</th>
              <th className="px-6 py-3 font-medium">Purpose</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium text-right">Messages</th>
              <th className="px-6 py-3 font-medium">Mining</th>
              <th className="px-6 py-3 font-medium">Last mined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ch) => (
              <tr
                key={ch.id}
                onClick={() => setSelected(ch)}
                className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer align-top"
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">{ch.is_private ? "🔒" : "#"}</span>
                    <span className="font-medium text-zinc-900">{ch.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-zinc-600 max-w-md">
                  <span className="line-clamp-2">
                    {ch.purpose_extracted ?? ch.purpose_native ?? (
                      <span className="text-zinc-400 italic">— mine to extract</span>
                    )}
                  </span>
                </td>
                <td className="px-6 py-3 text-zinc-500">{ch.category ?? "—"}</td>
                <td className="px-6 py-3 text-right tabular-nums text-zinc-700">
                  {ch.message_count_6mo.toLocaleString()}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                      STATUS_STYLES[ch.mining_status]
                    }`}
                  >
                    {ch.mining_status}
                  </span>
                  {ch.mining_error && (
                    <div className="text-xs text-rose-600 mt-0.5 truncate max-w-[180px]">
                      {ch.mining_error}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-zinc-500">
                  <RelTime iso={ch.mining_last_run_at} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                  No channels match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ChannelDetailDrawer
          channel={selected}
          workspaceId={workspaceId}
          teamDomain={teamDomain}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
            value === o.value
              ? "bg-zinc-900 text-white"
              : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChannelDetailDrawer({
  channel,
  workspaceId,
  teamDomain,
  onClose,
}: {
  channel: Channel;
  workspaceId: string;
  teamDomain: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const slackLink = teamDomain
    ? `https://${teamDomain}.slack.com/archives/${channel.slack_channel_id}`
    : null;

  async function trigger() {
    setBusy(true);
    await fetch(`/api/workspace/${workspaceId}/channels/${channel.id}/mine`, { method: "POST" });
    setBusy(false);
    setTimeout(() => window.location.reload(), 1500);
  }

  const isMining = channel.mining_status === "queued" || channel.mining_status === "running";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-[640px] h-full bg-white border-l border-zinc-200 overflow-y-auto p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700"
        >
          ✕
        </button>
        <h2 className="text-xl font-semibold text-zinc-900">
          {channel.is_private ? "🔒 " : "#"}
          {channel.name}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          {channel.category && (
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {channel.category}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-md ${STATUS_STYLES[channel.mining_status]}`}
          >
            {channel.mining_status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Messages (6mo)" value={channel.message_count_6mo.toLocaleString()} />
          <Stat label="Contributors" value={channel.unique_contributors.toString()} />
          <StatJSX label="Last message">
            <RelTime iso={channel.last_message_at} />
          </StatJSX>
          <StatJSX label="Last mined">
            <RelTime iso={channel.mining_last_run_at} />
          </StatJSX>
        </div>

        <button
          onClick={trigger}
          disabled={busy || isMining}
          className={`mt-5 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isMining
              ? "bg-amber-50 text-amber-700 border border-amber-200 cursor-wait"
              : channel.mining_status === "done"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          }`}
        >
          {isMining
            ? "Mining…"
            : channel.mining_status === "done"
            ? "Re-mine this channel"
            : "Mine this channel"}
        </button>

        {channel.is_private && channel.mining_status === "failed" && (
          <p className="mt-2 text-xs text-amber-700">
            Private channel: you must be a member of this channel before mining works.
          </p>
        )}
        {channel.mining_error && (
          <p className="mt-2 text-xs text-rose-600">Last error: {channel.mining_error}</p>
        )}

        <section className="mt-6">
          <h3 className="text-xs uppercase text-zinc-500 mb-2">Purpose</h3>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {channel.purpose_extracted ?? channel.purpose_native ?? "—"}
          </p>
        </section>

        {slackLink && (
          <a
            href={slackLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-sm text-blue-700 hover:text-blue-900"
          >
            Open in Slack →
          </a>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-900 mt-1">{value}</p>
    </div>
  );
}

function StatJSX({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-900 mt-1">{children}</p>
    </div>
  );
}
