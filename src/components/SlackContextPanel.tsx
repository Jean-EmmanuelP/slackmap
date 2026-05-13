"use client";

import { useEffect, useState } from "react";

// Slack-as-context panel. Sits on /freshdesk between the Stripe nudge and
// the Inbox. Loads the current selection + ranked auto-suggestions, lets
// admins toggle channels on/off (max 5). When at least one channel is
// selected, the agent fetches the last ~30 messages per channel at draft
// time and injects them into the prompt so the LLM can cite real dev/ops
// timelines instead of escalating every "bug" ticket to needs_human.

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-3 border border-zinc-200 bg-zinc-50/40 px-4 py-2 text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
        {fr ? "Chargement du contexte Slack…" : "Loading Slack context…"}
      </div>
    );
  }

  if (!state || state.suggestions.length === 0) return null;

  const hasSelection = selectedCount > 0;

  return (
    <div className="mt-3 border border-zinc-200 bg-zinc-50/30 px-4 py-3 text-xs">
      <div className="flex items-start gap-3 flex-wrap">
        <span
          className={`size-1.5 rounded-full mt-1.5 shrink-0 ${hasSelection ? "bg-emerald-500" : "bg-zinc-300"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-900">
            {fr
              ? "Contexte Slack — sur quels channels l'agent écoute"
              : "Slack context — channels the agent listens to"}
          </div>
          <p className="mt-0.5 text-zinc-600 leading-relaxed">
            {fr
              ? "L'agent lit les ~30 derniers messages de ces channels pour citer les vrais délais de fix, bugs connus, travail en cours — au lieu d'escalader vers needs_human."
              : "The agent reads the last ~30 messages from these channels to cite real fix timelines, known bugs, ongoing work — instead of escalating to needs_human."}
          </p>
          {!expanded && (
            <div className="mt-2 flex items-center gap-2 flex-wrap font-[var(--font-mono)] uppercase tracking-wider">
              {hasSelection ? (
                <span className="text-emerald-800">
                  {selectedCount} {fr ? "channel(s) actifs" : "channel(s) active"}
                </span>
              ) : (
                <span className="text-zinc-500">
                  {fr ? "aucun channel sélectionné" : "no channel selected"}
                </span>
              )}
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">
                {state.suggestions.length}{" "}
                {fr ? "suggestion(s) auto-détectée(s)" : "auto-detected suggestion(s)"}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 text-zinc-700 hover:bg-white"
        >
          {expanded ? (fr ? "Réduire" : "Collapse") : fr ? "Configurer" : "Configure"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {fr
              ? `Top suggestions — coche jusqu'à ${MAX_SELECTED}`
              : `Top suggestions — pick up to ${MAX_SELECTED}`}
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
                          score {s.score.toFixed(0)} ·{" "}
                          {s.messageCount.toLocaleString()} msgs
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
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (fr ? "Sauvegarde…" : "Saving…") : fr ? "Sauvegarder" : "Save"}
            </button>
            {error && (
              <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-red-700">
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
