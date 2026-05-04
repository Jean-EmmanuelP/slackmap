import type { SkillSource } from "@/lib/db";

const LABELS: Record<SkillSource, string> = {
  slack: "Slack",
  freshdesk: "Freshdesk",
  manual: "Manual",
};

export function SourceBadge({ source }: { source: SkillSource | null | undefined }) {
  const s = (source ?? "slack") as SkillSource;
  return (
    <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)] shrink-0">
      {LABELS[s]}
    </span>
  );
}
