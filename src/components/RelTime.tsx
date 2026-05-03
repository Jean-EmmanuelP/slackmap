"use client";
import { useEffect, useState } from "react";

// Render relative time client-side only — Date.now() at SSR vs hydration
// differs by ~1s and causes hydration mismatches.
export function RelTime({
  iso,
  fallback = "—",
}: {
  iso: string | null;
  fallback?: string;
}) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!iso) {
      setLabel(fallback);
      return;
    }
    const update = () => setLabel(format(iso));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [iso, fallback]);

  return <span suppressHydrationWarning>{label}</span>;
}

function format(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
