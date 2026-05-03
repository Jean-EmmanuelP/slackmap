"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VaultAccessPanel } from "./VaultAccessPanel";

type Kind = "password" | "account" | "api_key" | "url" | "note" | "other";

type Entry = {
  id: string;
  vault_id: string;
  kind: Kind;
  label: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  has_secret: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "password", label: "Password" },
  { value: "account", label: "Account" },
  { value: "api_key", label: "API key" },
  { value: "url", label: "URL" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" },
];

export function VaultDetail({
  vaultId,
  workspaceId,
  initialVisibility,
  canWrite,
  canManage,
}: {
  vaultId: string;
  workspaceId: string;
  initialVisibility: "team" | "private";
  canWrite: boolean;
  canManage: boolean;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/vaults/${vaultId}`);
    if (!res.ok) {
      setError("failed_to_load");
      return;
    }
    const data = await res.json();
    setEntries((data.entries ?? []) as Entry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId]);

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/vaults/${vaultId}/entries/${id}`, { method: "DELETE" });
    load();
  }

  if (entries === null) {
    return (
      <div className="px-8 py-12 text-sm text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 py-4 flex items-center gap-3 border-b border-zinc-200">
        <Link
          href={`/vaults?ws=${workspaceId}`}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900"
        >
          ← All vaults
        </Link>
        <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)]">
          {initialVisibility === "team" ? "Shared with team" : "Private"}
        </span>
        <span className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {initialVisibility === "private" && canManage && (
            <button
              onClick={() => setAccessOpen(true)}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            >
              Manage access
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
            >
              + Add entry
            </button>
          )}
        </div>
      </div>

      {adding && canWrite && (
        <EntryForm
          vaultId={vaultId}
          mode="create"
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="px-8 py-16 text-center max-w-2xl mx-auto">
            <p className="text-sm text-zinc-600 leading-relaxed">
              No entries yet. Add credentials, account URLs, or notes the AI agent will need to
              execute skills.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--paper)] border-b border-zinc-200">
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                <th className="px-6 py-2.5 font-medium">Kind</th>
                <th className="px-6 py-2.5 font-medium">Label</th>
                <th className="px-6 py-2.5 font-medium">Username</th>
                <th className="px-6 py-2.5 font-medium">URL</th>
                <th className="px-6 py-2.5 font-medium">Secret</th>
                <th className="px-6 py-2.5 font-medium">Updated</th>
                {canWrite && <th className="px-6 py-2.5 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) =>
                editingId === e.id && canWrite ? (
                  <tr key={e.id} className="border-t border-zinc-200">
                    <td colSpan={canWrite ? 7 : 6} className="p-0">
                      <EntryForm
                        vaultId={vaultId}
                        mode="edit"
                        entry={e}
                        onClose={() => setEditingId(null)}
                        onSaved={() => {
                          setEditingId(null);
                          load();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    vaultId={vaultId}
                    expanded={expandedId === e.id}
                    onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    canWrite={canWrite}
                    onEdit={() => setEditingId(e.id)}
                    onDelete={() => deleteEntry(e.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {accessOpen && (
        <VaultAccessPanel vaultId={vaultId} onClose={() => setAccessOpen(false)} />
      )}

      {error && (
        <div className="px-8 py-3 text-xs text-rose-700 font-[var(--font-mono)]">{error}</div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  vaultId,
  expanded,
  onToggle,
  canWrite,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  vaultId: string;
  expanded: boolean;
  onToggle: () => void;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function reveal() {
    const res = await fetch(`/api/vaults/${vaultId}/entries/${entry.id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.secret !== "string") return;
    setRevealed(data.secret);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRevealed(null), 10_000);
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
  }

  async function copySecret() {
    const res = await fetch(`/api/vaults/${vaultId}/entries/${entry.id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.secret === "string") copy(data.secret);
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-t border-zinc-200 hover:bg-zinc-100/50 cursor-pointer align-top"
      >
        <td className="px-6 py-3">
          <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)]">
            {entry.kind.replace("_", " ")}
          </span>
        </td>
        <td className="px-6 py-3 text-zinc-900 font-medium">{entry.label}</td>
        <td className="px-6 py-3 font-[var(--font-mono)] text-zinc-700">
          {entry.username ? (
            <span className="inline-flex items-center gap-2">
              <span className="truncate max-w-[200px]">{entry.username}</span>
              <CopyButton onClick={(e) => { e.stopPropagation(); copy(entry.username!); }} />
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className="px-6 py-3">
          {entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2 truncate inline-block max-w-[260px]"
            >
              {entry.url}
            </a>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className="px-6 py-3">
          {entry.has_secret ? (
            <span className="inline-flex items-center gap-2 font-[var(--font-mono)] text-zinc-700">
              <span className="tracking-widest">
                {revealed ?? "••••••••"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (revealed) {
                    setRevealed(null);
                    if (timer.current) clearTimeout(timer.current);
                  } else {
                    reveal();
                  }
                }}
                className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900 border border-zinc-300 px-1.5 py-0.5"
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
              <CopyButton
                onClick={(e) => {
                  e.stopPropagation();
                  copySecret();
                }}
              />
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className="px-6 py-3 text-zinc-500 text-xs font-[var(--font-mono)]">
          {new Date(entry.updated_at).toLocaleDateString()}
        </td>
        {canWrite && (
          <td className="px-6 py-3 text-right whitespace-nowrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900 mr-3"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-rose-600 hover:text-rose-800"
            >
              Delete
            </button>
          </td>
        )}
      </tr>
      {expanded && entry.notes && (
        <tr className="border-t border-zinc-100 bg-zinc-50/40">
          <td colSpan={canWrite ? 7 : 6} className="px-6 py-3 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
            {entry.notes}
          </td>
        </tr>
      )}
    </>
  );
}

function CopyButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        onClick(e);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900 border border-zinc-300 px-1.5 py-0.5"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function EntryForm({
  vaultId,
  mode,
  entry,
  onClose,
  onSaved,
}: {
  vaultId: string;
  mode: "create" | "edit";
  entry?: Entry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>(entry?.kind ?? "password");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [url, setUrl] = useState(entry?.url ?? "");
  const [secret, setSecret] = useState("");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const url2 = mode === "create"
        ? `/api/vaults/${vaultId}/entries`
        : `/api/vaults/${vaultId}/entries/${entry!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body: Record<string, unknown> = {
        kind,
        label: label.trim(),
        username: username.trim(),
        url: url.trim(),
        notes: notes,
      };
      // Only send secret if user typed something. On edit, sending an empty
      // string would clear the existing secret — which we treat as "no
      // change" unless the user explicitly hits the clear button (future).
      if (secret.length > 0) body.secret = secret;
      const res = await fetch(url2, {
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
    <form
      onSubmit={submit}
      className="px-8 py-5 border-b border-zinc-200 bg-zinc-50/40"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            placeholder="Stripe Dashboard (prod)"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Username / handle
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ops@company.com"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://dashboard.stripe.com"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Secret {mode === "edit" && entry?.has_secret && (
              <span className="text-zinc-400 normal-case tracking-normal">— leave blank to keep existing</span>
            )}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
            placeholder={mode === "edit" && entry?.has_secret ? "•••••••• (unchanged)" : "Type or paste"}
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Notes
          </label>
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Context the AI agent needs (env, owner, gotchas)"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>
      {err && (
        <div className="mt-3 text-xs text-rose-700 font-[var(--font-mono)]">{err}</div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
        >
          {busy ? "Saving…" : mode === "create" ? "Add entry" : "Save changes"}
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
