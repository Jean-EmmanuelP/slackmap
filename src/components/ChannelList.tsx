"use client";

import { useMemo, useState } from "react";
import type { Channel } from "@/lib/db";
import { RelTime } from "./RelTime";

const STATUS_STYLES: Record<Channel["mining_status"], string> = {
  idle: "border border-zinc-300 text-zinc-500",
  queued: "border border-zinc-400 text-zinc-700",
  running: "border border-zinc-500 text-zinc-800 animate-pulse",
  done: "border border-zinc-700 text-zinc-900",
  failed: "border border-zinc-400 text-zinc-700",
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
          className="flex-1 max-w-sm px-3 py-2 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
        <FilterChips
          options={[
            { value: "all", label: "all" },
            { value: "public", label: "public" },
            { value: "private", label: "private" },
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
        <span className="ml-auto text-xs text-zinc-500 font-[var(--font-mono)]">{filtered.length} channels</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--paper)] border-b border-zinc-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              <th className="px-6 py-2.5 font-medium">Channel</th>
              <th className="px-6 py-2.5 font-medium">Purpose</th>
              <th className="px-6 py-2.5 font-medium">Category</th>
              <th className="px-6 py-2.5 font-medium text-right">Messages</th>
              <th className="px-6 py-2.5 font-medium">Mining</th>
              <th className="px-6 py-2.5 font-medium">Last mined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ch) => (
              <tr
                key={ch.id}
                onClick={() => setSelected(ch)}
                className="border-t border-zinc-200 hover:bg-zinc-100/50 cursor-pointer align-top"
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
                    className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-[var(--font-mono)] ${
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
    <div className="flex border border-zinc-300">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors ${
            i > 0 ? "border-l border-zinc-300" : ""
          } ${
            value === o.value
              ? "bg-zinc-900 text-[var(--paper)]"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
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
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <aside className="w-[640px] h-full bg-[var(--paper)] border-l border-zinc-300 overflow-y-auto p-8 shadow-2xl">
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
            className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 ${STATUS_STYLES[channel.mining_status]}`}
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
          className={`mt-5 w-full px-3 py-2 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors border ${
            isMining
              ? "border-zinc-300 text-zinc-500 cursor-wait"
              : "border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800"
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
    <div className="border border-zinc-200 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">{label}</p>
      <p className="text-sm font-medium text-zinc-900 mt-1">{value}</p>
    </div>
  );
}

function StatJSX({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">{label}</p>
      <p className="text-sm font-medium text-zinc-900 mt-1">{children}</p>
    </div>
  );
}
