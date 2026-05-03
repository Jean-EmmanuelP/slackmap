"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/lib/db";

export function PeopleTable({
  people,
  workspaceId,
}: {
  people: Person[];
  workspaceId: string;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return people;
    return people.filter(
      (p) =>
        (p.display_name?.toLowerCase().includes(ql) ?? false) ||
        (p.real_name?.toLowerCase().includes(ql) ?? false) ||
        (p.role_extracted?.toLowerCase().includes(ql) ?? false) ||
        p.tools.some((t) => t.toLowerCase().includes(ql)) ||
        p.expertise.some((e) => e.toLowerCase().includes(ql)),
    );
  }, [people, q]);

  async function refresh() {
    setBusy(true);
    await fetch(`/api/workspace/${workspaceId}/extract-people`, { method: "POST" });
    setBusy(false);
    setTimeout(() => window.location.reload(), 3000);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-zinc-200">
        <input
          type="search"
          placeholder="Search name, role, tool, expertise…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
        <button
          onClick={refresh}
          disabled={busy}
          className="ml-auto px-3 py-1.5 text-[11px] uppercase tracking-wider font-[var(--font-mono)] border border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Queueing…" : "Re-extract people"}
        </button>
        <span className="text-xs text-zinc-500 font-[var(--font-mono)]">{filtered.length} people</span>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
            No people yet. Mine some channels first, then click <span className="px-1">🔄 Re-extract people</span>.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtered.map((p) => (
              <li
                key={p.id}
                onClick={() => setSelected(p)}
                className="px-6 py-4 hover:bg-zinc-50 cursor-pointer flex items-center gap-4"
              >
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-sm">
                    {(p.display_name ?? p.real_name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-zinc-900">
                      {p.display_name ?? p.real_name ?? "?"}
                    </span>
                    {p.role_extracted && (
                      <span className="text-xs text-zinc-600">{p.role_extracted}</span>
                    )}
                  </div>
                  {p.summary && (
                    <p className="text-sm text-zinc-600 mt-0.5 truncate">{p.summary}</p>
                  )}
                  {(p.tools.length > 0 || p.expertise.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.tools.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 border border-zinc-300 text-zinc-700 text-[11px] font-[var(--font-mono)]"
                        >
                          {t}
                        </span>
                      ))}
                      {p.expertise.slice(0, 4).map((e) => (
                        <span
                          key={e}
                          className="px-2 py-0.5 border border-zinc-400 text-zinc-800 text-[11px] font-[var(--font-mono)]"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-zinc-500 shrink-0">
                  <div>{p.message_count} msgs</div>
                  {p.last_seen_at && (
                    <div className="mt-0.5">{new Date(p.last_seen_at).toLocaleDateString()}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <PersonPanel
          person={selected}
          workspaceId={workspaceId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PersonPanel({
  person,
  workspaceId,
  onClose,
}: {
  person: Person;
  workspaceId: string;
  onClose: () => void;
}) {
  const [hint, setHint] = useState("");
  const [showHintInput, setShowHintInput] = useState(false);
  const [busy, setBusy] = useState<null | "reextract" | "former" | "delete">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reExtract() {
    setBusy("reextract");
    setMsg(null);
    const body = hint.trim() ? { hint: hint.trim() } : {};
    await fetch(`/api/workspace/${workspaceId}/people/${person.id}/re-extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(hint.trim() ? "Re-extracting with your context…" : "Re-extracting…");
    setBusy(null);
    setTimeout(() => window.location.reload(), 4000);
  }

  async function markFormer() {
    if (!confirm(`Mark ${person.display_name ?? "this person"} as former member?`)) return;
    setBusy("former");
    await fetch(`/api/workspace/${workspaceId}/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "former" }),
    });
    setBusy(null);
    window.location.reload();
  }

  async function del() {
    if (!confirm(`Delete ${person.display_name ?? "this person"}? They may reappear on next people extraction.`)) return;
    setBusy("delete");
    await fetch(`/api/workspace/${workspaceId}/people/${person.id}`, { method: "DELETE" });
    setBusy(null);
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-[640px] h-full bg-white border-l border-zinc-200 overflow-y-auto p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800"
        >
          ✕
        </button>

        <div className="flex items-center gap-4">
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatar_url} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600">
              {(person.display_name ?? person.real_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              {person.display_name ?? person.real_name ?? "?"}
            </h2>
            {person.title && <p className="text-sm text-zinc-600">{person.title}</p>}
            {person.role_extracted && (
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mt-1">
                {person.role_extracted}
              </p>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-5 space-y-2">
          {!showHintInput ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowHintInput(true)}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100"
              >
                Re-extract with context
              </button>
              <button
                onClick={reExtract}
                disabled={busy !== null}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                Re-extract
              </button>
              <button
                onClick={markFormer}
                disabled={busy !== null}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                Mark as former
              </button>
              <button
                onClick={del}
                disabled={busy !== null}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                Tell the AI what it got wrong (or what context to use)
              </label>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="ex: Marc is actually our Head of Design, not an engineer. He uses Figma daily and runs design reviews on Tuesdays."
                rows={4}
                className="w-full px-3 py-2 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={reExtract}
                  disabled={busy !== null || !hint.trim()}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
                >
                  Re-extract with this context
                </button>
                <button
                  onClick={() => {
                    setShowHintInput(false);
                    setHint("");
                  }}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {msg && <p className="text-xs text-zinc-700 font-[var(--font-mono)] mt-2">{msg}</p>}
        </div>

        {person.summary && (
          <Section title="Summary">
            <p className="text-sm text-zinc-800 leading-relaxed">{person.summary}</p>
          </Section>
        )}

        {person.tools.length > 0 && (
          <Section title="Tools">
            <div className="flex flex-wrap gap-1.5">
              {person.tools.map((t) => (
                <span key={t} className="px-2 py-0.5 border border-zinc-300 text-zinc-700 text-[11px] font-[var(--font-mono)]">
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}

        {person.expertise.length > 0 && (
          <Section title="Expertise">
            <div className="flex flex-wrap gap-1.5">
              {person.expertise.map((e) => (
                <span key={e} className="px-2 py-0.5 border border-zinc-400 text-zinc-800 text-[11px] font-[var(--font-mono)]">
                  {e}
                </span>
              ))}
            </div>
          </Section>
        )}

        {person.top_channels.length > 0 && (
          <Section title={`Active in (${person.top_channels.length} channels)`}>
            <ul className="space-y-1">
              {person.top_channels.map((c) => (
                <li key={c.slack_channel_id} className="text-sm text-zinc-700 flex justify-between">
                  <span>#{c.name}</span>
                  <span className="text-zinc-500">{c.count} msgs</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Activity">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
              <p className="text-xs text-zinc-500">Messages observed</p>
              <p className="text-lg font-medium text-zinc-900 mt-1">{person.message_count}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
              <p className="text-xs text-zinc-500">Confidence</p>
              <p className="text-lg font-medium text-zinc-900 mt-1">
                {Math.round(person.confidence * 100)}%
              </p>
            </div>
          </div>
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
