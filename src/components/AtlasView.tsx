"use client";

// Atlas v2 — Knowledge Map (clustered view).
//
// Previous version: alphabetical-ish table of channels sorted by message
// count. The user critique was sharp: "ça sert un peu à rien". The page
// answered "what channels exist?" — a question no one asks.
//
// v2 answers: "Where does the knowledge live in this company, and what
// does each domain ACT ON?" — by grouping channels into 9 fixed clusters
// (product / engineering / support / billing / marketing / ops / hr /
// general / dormant) with stats and drill-down.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/db";
import {
  bucketize,
  clusterHealth,
  type ClusterBucket,
} from "@/lib/atlas/clusters";
import { AnthropicKeyButton } from "./AnthropicKeyButton";
import { FreshdeskConnectButton } from "./FreshdeskConnectButton";

export function AtlasView({
  channels,
  teamDomain,
  workspaceId,
  skillCountsByChannel,
}: {
  channels: Channel[];
  teamDomain: string | null;
  workspaceId: string;
  /** Map of slack_channel_id → number of skills extracted from this channel */
  skillCountsByChannel?: Record<string, number>;
}) {
  const buckets = useMemo(() => bucketize(channels), [channels]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mineResult, setMineResult] = useState<string | null>(null);

  async function mineAllPublic() {
    setBusy(true);
    setMineResult(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/mine-all-public`, {
        method: "POST",
      });
      const data = await res.json();
      setMineResult(`Queued ${data.queuedCount ?? 0} channels`);
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setMineResult("Failed");
    } finally {
      setBusy(false);
    }
  }

  const totalSkills = Object.values(skillCountsByChannel ?? {}).reduce((s, n) => s + n, 0);
  const knowledgeBuckets = buckets.filter((b) => b.meta.id !== "general" && b.meta.id !== "dead");

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      {/* === Hero — Knowledge Map proposition ====================== */}
      <header className="mb-8 max-w-3xl">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
          Atlas · Knowledge Map
        </div>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-zinc-900">
          Where knowledge lives in your company.
        </h1>
        <p className="mt-3 text-base text-zinc-600 leading-relaxed">
          {channels.length} channels grouped into{" "}
          <span className="font-medium text-zinc-900">{buckets.length} domains</span>. The brain
          extracts skills from each — surfaced here so you see what acts on your support queue and
          what's dormant.
        </p>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Stat value={knowledgeBuckets.length} label="active domains" accent={knowledgeBuckets.length > 0} />
          <Stat value={totalSkills} label="skills extracted" accent={totalSkills > 0} />
          <Stat
            value={buckets.find((b) => b.meta.id === "dead")?.channels.length ?? 0}
            label="dormant channels"
          />
        </div>
      </header>

      {/* Secondary admin row — small, demoted from the previous primary toolbar */}
      <div className="mb-8 flex items-center gap-3 flex-wrap text-xs">
        <button
          onClick={mineAllPublic}
          disabled={busy}
          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy ? "Queueing…" : "Re-mine all"}
        </button>
        {mineResult && (
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {mineResult}
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400">
          · click any channel to mine individually
        </span>
        <div className="ml-auto flex items-center gap-2">
          <FreshdeskConnectButton workspaceId={workspaceId} />
          <AnthropicKeyButton workspaceId={workspaceId} />
        </div>
      </div>

      {/* === The map — cluster cards ============================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map((bucket) => (
          <ClusterCard
            key={bucket.meta.id}
            bucket={bucket}
            skillsCount={sumClusterSkills(bucket, skillCountsByChannel)}
            selected={selected === bucket.meta.id}
            onSelect={() => setSelected(selected === bucket.meta.id ? null : bucket.meta.id)}
          />
        ))}
      </section>

      {/* === Drill-down for selected cluster ===================== */}
      {selected && (
        <section className="mt-8 border-t-2 border-zinc-900 pt-6">
          <ClusterDrillDown
            bucket={buckets.find((b) => b.meta.id === selected)!}
            teamDomain={teamDomain}
            workspaceId={workspaceId}
            skillCountsByChannel={skillCountsByChannel}
            onClose={() => setSelected(null)}
          />
        </section>
      )}
    </div>
  );
}

function sumClusterSkills(
  bucket: ClusterBucket,
  skillCountsByChannel?: Record<string, number>,
): number {
  if (!skillCountsByChannel) return 0;
  return bucket.channels.reduce(
    (sum, c) => sum + (skillCountsByChannel[c.slack_channel_id] ?? 0),
    0,
  );
}

function ClusterCard({
  bucket,
  skillsCount,
  selected,
  onSelect,
}: {
  bucket: ClusterBucket;
  skillsCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const health = clusterHealth(bucket);
  const isDead = bucket.meta.id === "dead";
  const isGeneral = bucket.meta.id === "general";

  const healthDot = {
    active: "bg-emerald-500",
    slowing: "bg-amber-400",
    dormant: "bg-zinc-300",
  }[health];

  const cardBorder = selected
    ? "border-zinc-900 border-2"
    : isDead
      ? "border-zinc-200 bg-zinc-50/40"
      : isGeneral
        ? "border-zinc-200"
        : "border-zinc-300 hover:border-zinc-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left border ${cardBorder} bg-white/40 p-4 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{bucket.meta.emoji}</span>
          <span className="text-sm font-medium text-zinc-900">{bucket.meta.label}</span>
        </div>
        <span
          className={`size-2 rounded-full ${healthDot}`}
          title={`${health}${bucket.mostRecentActivityAt ? ` · last activity ${formatRelative(bucket.mostRecentActivityAt)}` : ""}`}
        />
      </div>

      <p className="text-[11px] text-zinc-500 leading-snug mb-3 min-h-[2.4em]">
        {bucket.meta.hint}
      </p>

      <div className="space-y-1 mb-3 font-[var(--font-mono)] text-[11px]">
        <StatLine
          value={bucket.channels.length}
          label={bucket.channels.length === 1 ? "channel" : "channels"}
        />
        {!isDead && (
          <StatLine
            value={skillsCount}
            label={skillsCount === 1 ? "skill extracted" : "skills extracted"}
            accent={skillsCount > 0}
          />
        )}
        <StatLine
          value={bucket.totalMessages.toLocaleString()}
          label="msgs (6mo)"
          dim
        />
      </div>

      {bucket.topChannels.length > 0 && (
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-[var(--font-mono)] truncate">
          {bucket.topChannels.map((c) => `#${c.name}`).join(" · ")}
        </div>
      )}
    </button>
  );
}

function ClusterDrillDown({
  bucket,
  teamDomain,
  workspaceId,
  skillCountsByChannel,
  onClose,
}: {
  bucket: ClusterBucket;
  teamDomain: string | null;
  workspaceId: string;
  skillCountsByChannel?: Record<string, number>;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{bucket.meta.emoji}</span>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-900">{bucket.meta.label}</h2>
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {bucket.channels.length} channels
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-zinc-900"
        >
          Close ×
        </button>
      </div>

      <p className="text-sm text-zinc-600 mb-5 max-w-2xl">{bucket.meta.hint}</p>

      <div className="border border-zinc-200 bg-white/40 divide-y divide-zinc-100">
        {bucket.channels.map((c) => {
          const skills = skillCountsByChannel?.[c.slack_channel_id] ?? 0;
          const isArchived = c.archived;
          const recent = c.last_message_at ? formatRelative(c.last_message_at) : "never";
          return (
            <div key={c.id} className="px-4 py-3 flex items-center gap-4 flex-wrap">
              <Link
                href={`/atlas/${c.id}?ws=${workspaceId}`}
                className={`text-sm font-[var(--font-mono)] min-w-0 truncate ${isArchived ? "text-zinc-400" : "text-zinc-900 hover:underline"}`}
              >
                #{c.name}
              </Link>
              <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
                {c.message_count_6mo.toLocaleString()} msgs
              </span>
              <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
                {c.unique_contributors} people
              </span>
              {skills > 0 && (
                <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-700 tabular-nums">
                  {skills} skill{skills > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 ml-auto">
                {isArchived ? "archived" : `active ${recent}`}
              </span>
              {teamDomain && (
                <a
                  href={`https://${teamDomain}.slack.com/archives/${c.slack_channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 hover:text-zinc-700"
                >
                  Open in Slack ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-2xl font-medium tabular-nums ${accent ? "text-emerald-700" : "text-zinc-900"}`}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function StatLine({
  value,
  label,
  accent,
  dim,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-1.5 ${dim ? "opacity-60" : ""}`}
    >
      <span
        className={`tabular-nums font-medium ${accent ? "text-emerald-700" : "text-zinc-900"}`}
      >
        {value}
      </span>
      <span className="uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  if (diffDay < 60) return `${Math.round(diffDay / 7)}w ago`;
  return `${Math.round(diffDay / 30)}mo ago`;
}
