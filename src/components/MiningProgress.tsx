"use client";

import { useEffect, useRef, useState } from "react";

type Progress = {
  channels: {
    total: number;
    idle: number;
    queued: number;
    running: number;
    done: number;
    failed: number;
    with_purpose: number;
  };
  glossary: number;
  skills: number;
  people: number;
  inProgress: number;
  isActive: boolean;
};

// Polls /api/workspace/[id]/mining-progress every 2.5s so the user sees
// channels move through queued → running → done in real time, with totals
// for glossary/skills/people.
export function MiningProgress({ workspaceId }: { workspaceId: string }) {
  const [p, setP] = useState<Progress | null>(null);
  const lastInProgress = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchOnce() {
      try {
        const res = await fetch(`/api/workspace/${workspaceId}/mining-progress`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: Progress = await res.json();
        if (cancelled) return;
        // Reload page once when work transitions from "in progress" → "done"
        // so the channel graph re-renders with fresh purposes/categories.
        if (
          lastInProgress.current !== null &&
          lastInProgress.current > 0 &&
          data.inProgress === 0
        ) {
          window.location.reload();
          return;
        }
        lastInProgress.current = data.inProgress;
        setP(data);
      } catch {
        // ignore transient errors
      }
    }

    fetchOnce();
    interval = setInterval(fetchOnce, 2500);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [workspaceId]);

  if (!p) return null;
  const c = p.channels;
  const pctDone = c.total > 0 ? Math.round(((c.done + c.failed) / c.total) * 100) : 0;

  return (
    <div className="px-6 py-2 border-b border-zinc-200 text-[11px] flex items-center gap-4 flex-wrap font-[var(--font-mono)] uppercase tracking-wider">
      {p.isActive ? (
        <>
          <span className="inline-flex items-center gap-2 text-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse" />
            Mining {c.done + c.failed} / {c.total} ({pctDone}%)
          </span>
          <span className="text-zinc-500">
            {c.running} running · {c.queued} queued
          </span>
        </>
      ) : (
        <span className="inline-flex items-center gap-2 text-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          {c.done} channels mined
          {c.failed > 0 && <span className="text-zinc-500 ml-2">· {c.failed} failed</span>}
        </span>
      )}
      <span className="ml-auto flex gap-4 text-zinc-500">
        <span>{c.with_purpose} purposes</span>
        <span>{p.glossary} glossary</span>
        <span>{p.people} people</span>
        <span>{p.skills} skills</span>
      </span>
    </div>
  );
}
