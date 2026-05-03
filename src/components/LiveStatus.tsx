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
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm flex items-center gap-3">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        Mining your Slack… {progress}/{total} channels ({pct}%)
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm">
        Backfill failed. Check Inngest logs.
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-emerald-50/40 border-b border-zinc-200 text-zinc-500 text-xs flex items-center gap-2">
      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
      Live — last update {relativeTime(lastEventAt)}
    </div>
  );
}
