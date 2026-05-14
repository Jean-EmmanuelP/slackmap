"use client";

import { useEffect, useState } from "react";

// Slack-as-context tile. Lives in the /freshdesk Setup row, side-by-side
// with the Stripe nudge. Visual language matches Stripe so the two tools
// read as equal-weight configuration tiles:
//   - INDIGO bordered tile when not configured (CTA to set up)
//   - EMERALD confirmation line + channel name inline when configured
//   - Expandable into a full configuration list with auto-suggestions
//
// Goal: the agent fetches the last ~30 messages per nominated channel at
// draft time and injects them into the prompt so the LLM can cite real
// fix timelines and ongoing dev work instead of escalating every "bug"
// ticket to needs_human.

type Suggestion = {
  channelId: string;
  dbId: string;
  name: string;
  score: number;
  reasons: string[];
  messageCount: number;
  lastMessageAt: string | null;
};

type SlackContextState = {
  selected: string[];
  suggestions: Suggestion[];
  totalChannels: number;
};

const MAX_SELECTED = 5;

export function SlackContextPanel({
  workspaceId,
  lang,
}: {
  workspaceId: string;
  lang: string;
}) {
  const [state, setState] = useState<SlackContextState | null>(null);
  const [draftSelected, setDraftSelected] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fr = lang === "fr";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspace/${workspaceId}/slack-context`);
        if (!res.ok) throw new Error(`${res.status}`);
        const body = (await res.json()) as SlackContextState;
        if (cancelled) return;
        setState(body);
        setDraftSelected(new Set(body.selected));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const selectedCount = draftSelected?.size ?? 0;
  const dirty =
    state &&
    draftSelected &&
    (state.selected.length !== draftSelected.size ||
      state.selected.some((id) => !draftSelected.has(id)));

  // Resolve selected ids → channel names so we can show them inline
  const selectedChannelNames = state
    ? state.selected
        .map((id) => state.suggestions.find((s) => s.channelId === id)?.name)
        .filter((n): n is string => !!n)
    : [];

  function toggle(channelId: string) {
    if (!draftSelected) return;
    const next = new Set(draftSelected);
    if (next.has(channelId)) {
      next.delete(channelId);
    } else if (next.size < MAX_SELECTED) {
      next.add(channelId);
    }
    setDraftSelected(next);
  }

  async function save() {
    if (!draftSelected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/slack-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelIds: Array.from(draftSelected) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setState({ ...(state ?? { suggestions: [], totalChannels: 0 }), selected: body.selected });
      // After successful save, collapse back to the confirmation card so
      // the user sees the green "Contexte Slack actif · #channels" line —
      // otherwise the expanded list stays open and they think nothing happened.
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="border border-zinc-200 bg-zinc-50/40 px-4 py-3 text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
        {fr ? "Chargement…" : "Loading…"}
      </div>
    );
  }

  // Workspace has no minable channels (e.g., Slack not yet OAuth'd or backfill
  // hasn't run). Hide the panel rather than show a useless empty state.
  if (!state || state.suggestions.length === 0) return null;

  const hasSelection = selectedCount > 0;

  // === CONFIGURED STATE: emerald confirmation, matching Stripe-connected style
  if (hasSelection && !expanded) {
    return (
      <div className="border border-emerald-200 bg-emerald-50/40 px-4 py-3 flex items-start gap-3 text-xs h-full">
        <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-emerald-900">
            {fr ? "Contexte Slack actif" : "Slack context active"}
          </div>
          <div className="mt-0.5 text-zinc-700 truncate">
            {fr ? "L'agent lit " : "Agent listens to "}
            <span className="font-[var(--font-mono)] text-emerald-800">
              {selectedChannelNames.map((n) => `#${n}`).join(" · ")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 leading-snug">
            {fr
              ? "Ex : au lieu d'escalader « problème accès appli », l'agent peut citer « fix prévu jeudi v2.3.1 » s'il voit le bug discuté."
              : "E.g.: instead of escalating \"login bug\", the agent can cite \"fix shipping Thursday v2.3.1\" when it sees the bug being discussed."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-emerald-300 text-emerald-900 hover:bg-emerald-100"
        >
          {fr ? "Modifier" : "Edit"}
        </button>
      </div>
    );
  }

  // === UNCONFIGURED STATE: indigo CTA tile, matching Stripe-not-connected style
  if (!hasSelection && !expanded) {
    return (
      <div className="border border-indigo-200 bg-indigo-50/40 px-4 py-3 flex items-start gap-3 text-xs h-full">
        <span className="size-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-indigo-900">
            {fr
              ? "Connecte un channel Slack pour les drafts contextuels"
              : "Connect a Slack channel for context-grounded drafts"}
          </div>
          <p className="mt-0.5 text-zinc-700 leading-relaxed">
            {fr
              ? "Sans contexte Slack, l'agent escalade les tickets bug/technique. Avec, il peut citer « fix prévu jeudi v2.3.1 » au lieu d'un escalade vide."
              : "Without Slack context, the agent escalates bug/technical tickets. With it, it can cite real fix timelines from your dev channels."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-indigo-900 bg-indigo-900 text-white hover:bg-indigo-800"
        >
          {fr ? "Configurer" : "Configure"}
        </button>
      </div>
    );
  }

  // === EXPANDED STATE: full configuration view
  return (
    <div className="border border-zinc-300 bg-zinc-50/30 px-4 py-3 text-xs">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-medium text-zinc-900">
            {fr ? "Contexte Slack" : "Slack context"}
          </div>
          <p className="mt-0.5 text-zinc-600 leading-snug">
            {fr
              ? `L'agent lira les ~30 derniers messages de ces channels à chaque draft. Max ${MAX_SELECTED}.`
              : `Agent will read the last ~30 messages from these channels per draft. Max ${MAX_SELECTED}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 text-zinc-700 hover:bg-white"
        >
          {fr ? "Réduire" : "Collapse"}
        </button>
      </div>

      <ul className="divide-y divide-zinc-200 border border-zinc-200 bg-white">
        {state.suggestions.map((s) => {
          const checked = draftSelected?.has(s.channelId) ?? false;
          const reachedCap = !checked && (draftSelected?.size ?? 0) >= MAX_SELECTED;
          return (
            <li key={s.channelId} className="px-3 py-2">
              <label
                className={`flex items-start gap-3 cursor-pointer ${reachedCap ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={reachedCap}
                  onChange={() => toggle(s.channelId)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900">#{s.name}</span>
                    <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 tabular-nums">
                      score {s.score.toFixed(0)} · {s.messageCount.toLocaleString()} msgs
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500 font-[var(--font-mono)]">
                    {s.reasons.slice(0, 3).join(" · ")}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 flex-wrap pt-2">
        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? (fr ? "Sauvegarde…" : "Saving…") : fr ? "Sauvegarder" : "Save"}
          </button>
        ) : (
          <span className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-emerald-500 bg-emerald-50 text-emerald-800 inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {fr
              ? `Sauvegardé · ${selectedCount} channel${selectedCount > 1 ? "s" : ""} actif${selectedCount > 1 ? "s" : ""}`
              : `Saved · ${selectedCount} channel${selectedCount === 1 ? "" : "s"} active`}
          </span>
        )}
        {error && (
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-red-700">
            {error}
          </span>
        )}
        {!dirty && selectedCount > 0 && (
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {fr
              ? "Modifie les cases puis Sauvegarde pour mettre à jour"
              : "Toggle checkboxes then Save to update"}
          </span>
        )}
      </div>
    </div>
  );
}
