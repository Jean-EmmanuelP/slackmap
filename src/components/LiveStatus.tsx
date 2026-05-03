"use client";

type Props = {
  status: "pending" | "running" | "ready" | "failed";
  progress: number;
  total: number;
  lastEventAt: string | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LiveStatus({ status, progress, total, lastEventAt }: Props) {
  if (status === "pending" || status === "running") {
    const pct = total > 0 ? Math.floor((progress / total) * 100) : 0;
    return (
      <div className="px-6 py-2 border-b border-zinc-200 text-zinc-700 text-xs flex items-center gap-3 font-[var(--font-mono)] uppercase tracking-wider">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
        Mining {progress}/{total} channels ({pct}%)
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="px-6 py-2 border-b border-zinc-300 text-zinc-700 text-xs font-[var(--font-mono)] uppercase tracking-wider">
        Backfill failed
      </div>
    );
  }

  return (
    <div className="px-6 py-2 border-b border-zinc-200 text-zinc-500 text-[11px] flex items-center gap-2 font-[var(--font-mono)] uppercase tracking-wider">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700" />
      Live — last update {relativeTime(lastEventAt)}
    </div>
  );
}
