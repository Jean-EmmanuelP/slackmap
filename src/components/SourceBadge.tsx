import type { SkillSource } from "@/lib/db";

const STYLES: Record<SkillSource, string> = {
  slack: "bg-violet-50 text-violet-700 border-violet-200",
  freshdesk: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const LABELS: Record<SkillSource, string> = {
  slack: "Slack",
  freshdesk: "Freshdesk",
};

export function SourceBadge({ source }: { source: SkillSource | null | undefined }) {
  const s = (source ?? "slack") as SkillSource;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide shrink-0 ${STYLES[s]}`}
    >
      {LABELS[s]}
    </span>
  );
}
