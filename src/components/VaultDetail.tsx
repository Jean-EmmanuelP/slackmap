"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VaultAccessPanel } from "./VaultAccessPanel";

type Kind = "password" | "account" | "api_key" | "url" | "note" | "env_file" | "other";

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
  { value: "env_file", label: "Env variable" },
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
  const [importingEnv, setImportingEnv] = useState(false);

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
              onClick={() => setImportingEnv(true)}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            >
              Import .env
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

      {importingEnv && canWrite && (
        <EnvImportModal
          vaultId={vaultId}
          onClose={() => setImportingEnv(false)}
          onImported={() => {
            setImportingEnv(false);
            load();
          }}
        />
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

function EnvImportModal({
  vaultId,
  onClose,
  onImported,
}: {
  vaultId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [content, setContent] = useState("");
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Array<{ key: string; value: string }> | null>(null);

  function parseEnv(text: string) {
    const lines = text.split("\n");
    const result: Array<{ key: string; value: string }> = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) result.push({ key, value });
    }
    return result;
  }

  useEffect(() => {
    setPreview(content.trim() ? parseEnv(content) : null);
  }, [content]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/import-env`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, prefix: prefix.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "import_failed");
        return;
      }
      onImported();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-[560px] h-full bg-[var(--paper)] border-l border-zinc-300 overflow-y-auto">
        <header className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Import .env file</h2>
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900"
          >
            Close
          </button>
        </header>

        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
              .env content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={`DATABASE_URL=postgres://...\nSTRIPE_SECRET_KEY=sk_live_...\n# comments are ignored\nNOTION_TOKEN=secret_...`}
              className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
              Key prefix (optional)
            </label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. BESTrong_"
              className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Each variable becomes a vault entry with prefix + key as label (e.g. BESTrong_DATABASE_URL)
            </p>
          </div>

          {preview && preview.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
                Preview ({preview.length} variables)
              </label>
              <div className="border border-zinc-200 max-h-48 overflow-y-auto divide-y divide-zinc-100">
                {preview.slice(0, 20).map((p, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-center gap-2 text-xs font-[var(--font-mono)]">
                    <span className="text-zinc-900 font-medium">{prefix.trim()}{p.key}</span>
                    <span className="text-zinc-400">=</span>
                    <span className="text-zinc-500 truncate">{p.value.length > 40 ? p.value.slice(0, 40) + "..." : p.value}</span>
                  </div>
                ))}
                {preview.length > 20 && (
                  <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-[var(--font-mono)]">
                    ...and {preview.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}

          {err && (
            <div className="text-xs text-rose-700 font-[var(--font-mono)]">{err}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${preview?.length ?? 0} variables`}
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
      </aside>
    </div>
  );
}
