"use client";

import { useMemo, useState } from "react";
import type { Skill, SkillSource } from "@/lib/db";
import { SourceBadge } from "./SourceBadge";

// Flat monochrome — no AI-pastel.
const TYPE_COLORS: Record<string, string> = {
  process: "border-zinc-300 text-zinc-700",
  policy: "border-zinc-300 text-zinc-700",
  decision: "border-zinc-300 text-zinc-700",
  escalation: "border-zinc-300 text-zinc-700",
};

const DOMAIN_LABELS: Record<string, string> = {
  engineering: "Engineering",
  product: "Product",
  support: "Support",
  ops: "Operations",
  sales: "Sales",
  marketing: "Marketing",
  leadership: "Leadership",
  other: "Other",
};

const DOMAIN_ORDER = [
  "engineering",
  "product",
  "support",
  "ops",
  "sales",
  "marketing",
  "leadership",
  "other",
];

export function SkillsTable({
  skills,
  workspaceId,
  teamDomain,
  channelNames,
  isAdmin,
  lang,
}: {
  skills: Skill[];
  workspaceId: string;
  teamDomain: string | null;
  channelNames?: Record<string, string>;
  isAdmin?: boolean;
  lang?: string;
}) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Skill["type"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SkillSource>("all");
  const [showDrafts, setShowDrafts] = useState(false);
  const [showConfidence, setShowConfidence] = useState(false);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeSkills = skills.filter((s) => s.status === "active");
  const draftSkills = skills.filter((s) => s.status === "draft");
  const visibleSkills = showDrafts ? skills : activeSkills;

  // Translation lookup: prefer translations[lang][field], fallback to canonical English.
  // Inline (no import shuffle) — keeps SkillsTable self-contained.
  function tr(skill: Skill, field: "title" | "trigger" | "steps_md" | "decision_criteria" | "escalation"): string | null {
    const code = (lang ?? "en").toLowerCase();
    if (code === "en") return (skill as Skill & Record<string, unknown>)[field] as string | null;
    type WithTranslations = Skill & { translations?: Record<string, Record<string, string | null | undefined>> | null };
    const t = (skill as WithTranslations).translations?.[code]?.[field];
    if (typeof t === "string" && t.trim().length > 0) return t;
    return (skill as Skill & Record<string, unknown>)[field] as string | null;
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return visibleSkills.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (sourceFilter !== "all" && (s.source ?? "slack") !== sourceFilter) return false;
      if (ql.length === 0) return true;
      // Search both canonical English and translated version for hits.
      const haystack = [
        s.title.toLowerCase(),
        s.slug.toLowerCase(),
        s.trigger?.toLowerCase() ?? "",
        (tr(s, "title") ?? "").toLowerCase(),
        (tr(s, "trigger") ?? "").toLowerCase(),
      ];
      return haystack.some((h) => h.includes(ql));
    });
  }, [visibleSkills, q, typeFilter, sourceFilter, lang]);

  const types: Array<"all" | Skill["type"]> = ["all", "process", "policy", "decision", "escalation"];
  const sources: Array<"all" | SkillSource> = ["all", "slack", "freshdesk", "manual"];

  return (
    <div className="flex-1 flex flex-col" key={refreshKey}>
      <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-zinc-200">
        <input
          type="search"
          placeholder="Search skills…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
        <div className="flex border border-zinc-300">
          {types.map((t, i) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors ${
                i > 0 ? "border-l border-zinc-300" : ""
              } ${
                typeFilter === t
                  ? "bg-zinc-900 text-[var(--paper)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex border border-zinc-300">
          {sources.map((s, i) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] transition-colors ${
                i > 0 ? "border-l border-zinc-300" : ""
              } ${
                sourceFilter === s
                  ? "bg-zinc-900 text-[var(--paper)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {isAdmin && draftSkills.length > 0 && (
          <button
            onClick={async () => {
              await fetch(`/api/workspace/${workspaceId}/merge-skills`, { method: "POST" });
              setRefreshKey((k) => k + 1);
            }}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
          >
            Merge drafts
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
          >
            + Add skill
          </button>
        )}
        <a
          href={`/api/workspace/${workspaceId}/skills.zip`}
          className="text-xs text-zinc-700 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-400 hover:decoration-zinc-700 font-[var(--font-mono)] uppercase tracking-wider"
        >
          Export bundle →
        </a>
        {draftSkills.length > 0 && (
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className={`text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border transition-colors ${
              showDrafts
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            Candidates ({draftSkills.length})
          </button>
        )}
        <button
          onClick={() => setShowConfidence((v) => !v)}
          title="Toggle confidence score column"
          className={`text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border transition-colors ${
            showConfidence
              ? "border-zinc-900 bg-zinc-900 text-[var(--paper)]"
              : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          {showConfidence ? "Hide confidence" : "Show confidence"}
        </button>
        <span className="text-xs text-zinc-500 font-[var(--font-mono)]">
          {filtered.length} {showDrafts ? "skills" : "validated"}
        </span>
      </div>

      {creating && isAdmin && (
        <SkillForm
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setRefreshKey((k) => k + 1); }}
        />
      )}

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-500 text-sm">
            No skills extracted yet. Mining in progress?
          </div>
        ) : (
          DOMAIN_ORDER.map((domain) => {
            const group = filtered.filter((s) => (s.domain ?? "other") === domain);
            if (group.length === 0) return null;
            return (
              <section key={domain} className="border-b border-zinc-200">
                <header className="sticky top-0 z-10 px-6 py-2 bg-[var(--paper)] border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                    {DOMAIN_LABELS[domain] ?? domain}
                  </h3>
                  <span className="text-[11px] text-zinc-500 tabular-nums font-[var(--font-mono)]">{group.length} skills</span>
                </header>
                <ul className="divide-y divide-zinc-200">
                  {group.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="px-6 py-3.5 hover:bg-zinc-100/50 cursor-pointer flex items-start gap-4"
                    >
                      <span
                        className={`mt-0.5 inline-block px-2 py-0.5 border text-[10px] uppercase tracking-wider font-[var(--font-mono)] shrink-0 ${
                          TYPE_COLORS[s.type] ?? ""
                        }`}
                      >
                        {s.type}
                      </span>
                      <span className="mt-0.5"><SourceBadge source={s.source} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-900 text-sm">{tr(s, "title") ?? s.title}</div>
                        {(tr(s, "trigger") ?? s.trigger) && (
                          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{tr(s, "trigger") ?? s.trigger}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)] tabular-nums">
                          {s.source_count} {s.source_count === 1 ? "source" : "sources"}
                        </span>
                        {showConfidence && <ConfidenceBar value={s.confidence} />}
                        <a
                          href={`/api/workspace/${workspaceId}/skills/${s.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2 font-[var(--font-mono)]"
                        >
                          .md
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {selected && (
        <SkillPanel
          skill={selected}
          teamDomain={teamDomain}
          channelNames={channelNames ?? {}}
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          lang={lang}
          onClose={() => setSelected(null)}
          onEdited={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-14 h-0.5 bg-zinc-200 overflow-hidden">
        <div className="h-full bg-zinc-900" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums font-[var(--font-mono)] text-zinc-600 w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function formatTs(ts: string): string {
  const seconds = parseFloat(ts);
  if (!Number.isFinite(seconds)) return ts;
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Top-level translation lookup used by SkillPanel (it's a separate component
// outside SkillsTable's scope, so it can't reuse the inline tr()).
function trPanel(
  skill: Skill,
  field: "title" | "trigger" | "steps_md" | "decision_criteria" | "escalation",
  lang: string | undefined,
): string | null {
  const code = (lang ?? "en").toLowerCase();
  const fallback = (skill as Skill & Record<string, unknown>)[field] as string | null;
  if (code === "en") return fallback;
  type WithTranslations = Skill & {
    translations?: Record<string, Record<string, string | null | undefined>> | null;
  };
  const t = (skill as WithTranslations).translations?.[code]?.[field];
  if (typeof t === "string" && t.trim().length > 0) return t;
  return fallback;
}

function SkillPanel({
  skill,
  teamDomain,
  channelNames,
  workspaceId,
  isAdmin,
  lang,
  onClose,
  onEdited,
}: {
  skill: Skill;
  teamDomain: string | null;
  channelNames: Record<string, string>;
  workspaceId: string;
  isAdmin?: boolean;
  lang?: string;
  onClose: () => void;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this skill?")) return;
    await fetch(`/api/workspace/${workspaceId}/skills`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: skill.id }),
    });
    onEdited();
  }

  if (editing && isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/50" onClick={() => setEditing(false)} />
        <aside className="w-[640px] h-full bg-[var(--paper)] border-l border-zinc-300 overflow-y-auto">
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">Edit skill</h2>
              <button onClick={() => setEditing(false)} className="text-zinc-500 hover:text-zinc-800">✕</button>
            </div>
            <SkillForm
              workspaceId={workspaceId}
              initial={skill}
              onClose={() => setEditing(false)}
              onSaved={() => { setEditing(false); onEdited(); }}
            />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-[640px] h-full bg-[var(--paper)] border-l border-zinc-300 overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <div>
            <div
              className={`inline-block px-2 py-0.5 border text-[10px] uppercase tracking-wider font-[var(--font-mono)] mb-3 ${
                TYPE_COLORS[skill.type] ?? ""
              }`}
            >
              {skill.type}
            </div>
            {isAdmin && skill.source === "manual" && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-600 hover:text-zinc-900 border border-zinc-300 px-2 py-0.5"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-rose-600 hover:text-rose-800 border border-zinc-300 px-2 py-0.5"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-800"
          >
            ✕
          </button>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900">{trPanel(skill, "title", lang)}</h2>
        <p className="text-xs text-zinc-500 font-[var(--font-mono)] mt-1">{skill.slug}</p>

        {trPanel(skill, "trigger", lang) && (
          <Section title="Trigger">
            <p className="text-zinc-700">{trPanel(skill, "trigger", lang)}</p>
          </Section>
        )}
        {trPanel(skill, "steps_md", lang) && (
          <Section title="Steps">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{trPanel(skill, "steps_md", lang)}</pre>
          </Section>
        )}
        {skill.decision_criteria && (
          <Section title="Decision criteria">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{skill.decision_criteria}</pre>
          </Section>
        )}
        {skill.escalation && (
          <Section title="Escalation">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{skill.escalation}</pre>
          </Section>
        )}

        <Section title={`Sources (${skill.citations.length})`}>
          <ul className="space-y-2">
            {skill.citations.map((c, i) => {
              const isFreshdesk = c.channel_id.startsWith("freshdesk-");
              const link =
                c.url ??
                (teamDomain && !isFreshdesk
                  ? `https://${teamDomain}.slack.com/archives/${c.channel_id}/p${c.ts.replace(".", "")}`
                  : null);
              const channelName = channelNames[c.channel_id];
              const label = isFreshdesk
                ? `Freshdesk @ ${formatTs(c.ts)}`
                : channelName
                ? `#${channelName} @ ${formatTs(c.ts)}`
                : `${c.channel_id} @ ${formatTs(c.ts)}`;
              return (
                <li key={i} className="text-xs text-zinc-700">
                  <div className="flex items-baseline gap-2">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-900 hover:text-zinc-700 underline underline-offset-2 decoration-zinc-400 hover:decoration-zinc-700 font-[var(--font-mono)] text-[11px] uppercase tracking-wider shrink-0"
                      >
                        {label}
                      </a>
                    ) : (
                      <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-zinc-500 shrink-0">
                        {label}
                      </span>
                    )}
                  </div>
                  {c.snippet && (
                    <p className="mt-1 text-zinc-600 italic line-clamp-3">
                      &ldquo;{c.snippet.slice(0, 200)}{c.snippet.length > 200 ? "…" : ""}&rdquo;
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}

const SKILL_TYPES: Array<{ value: Skill["type"]; label: string }> = [
  { value: "process", label: "Process" },
  { value: "policy", label: "Policy" },
  { value: "decision", label: "Decision" },
  { value: "escalation", label: "Escalation" },
];

const SKILL_DOMAINS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "support", label: "Support" },
  { value: "ops", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "leadership", label: "Leadership" },
  { value: "other", label: "Other" },
];

function SkillForm({
  workspaceId,
  initial,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  initial?: Skill;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [type, setType] = useState<Skill["type"]>(initial?.type ?? "process");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? "");
  const [stepsMd, setStepsMd] = useState(initial?.steps_md ?? "");
  const [decisionCriteria, setDecisionCriteria] = useState(initial?.decision_criteria ?? "");
  const [escalation, setEscalation] = useState(initial?.escalation ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isEdit) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 80)
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const url = `/api/workspace/${workspaceId}/skills`;
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        type,
        domain: domain || null,
        title: title.trim(),
        slug: slug.trim(),
        trigger: trigger.trim() || null,
        steps_md: stepsMd || null,
        decision_criteria: decisionCriteria || null,
        escalation: escalation || null,
      };
      if (isEdit) body.id = initial!.id;
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "save_failed");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Skill["type"])}
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700"
          >
            {SKILL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Domain
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700"
          >
            {SKILL_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
          placeholder="Approve a refund over $500"
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Slug
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          placeholder="approve-refund-over-500"
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Trigger
        </label>
        <input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="When a customer requests a refund exceeding $500"
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Steps
        </label>
        <textarea
          value={stepsMd}
          onChange={(e) => setStepsMd(e.target.value)}
          rows={6}
          placeholder={"1. Verify the order ID in Stripe\n2. Check refund eligibility in policy doc\n3. If amount > $500, escalate to finance"}
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Decision criteria
        </label>
        <textarea
          value={decisionCriteria}
          onChange={(e) => setDecisionCriteria(e.target.value)}
          rows={3}
          placeholder="if amount < $500 → agent processes immediately"
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Escalation
        </label>
        <textarea
          value={escalation}
          onChange={(e) => setEscalation(e.target.value)}
          rows={3}
          placeholder="Escalate to #finance channel if amount > $500 or customer is VIP"
          className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
        />
      </div>
      {err && (
        <div className="text-xs text-rose-700 font-[var(--font-mono)]">
          {err === "duplicate_slug" ? "A skill with that slug already exists." : err}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !title.trim() || !slug.trim()}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create skill"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
