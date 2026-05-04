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

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
      <path d="M4.22 12.53L4.75 13.06L5.81 12L5.28 11.47L1.81 8L5.28 4.53L5.81 4L4.75 2.94L4.22 3.47L0.4 7.29C0.01 7.68 0.01 8.32 0.4 8.71L4.22 12.53ZM11.78 12.53L11.25 13.06L10.19 12L10.72 11.47L14.19 8L10.72 4.53L10.19 4L11.25 2.94L11.78 3.47L15.6 7.29C15.99 7.68 15.99 8.32 15.6 8.71L11.78 12.53Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.02 4.77C6.12 2.34 9.88 2.34 11.98 4.77L14.76 8L11.98 11.23C9.88 13.66 6.12 13.66 4.02 11.23L1.24 8L4.02 4.77ZM13.11 3.79C10.42.66 5.58.66 2.89 3.79L-.32 7.51V8.49L2.89 12.21C5.58 15.34 10.42 15.34 13.11 12.21L16.32 8.49V7.51L13.11 3.79ZM6.5 8C6.5 7.17 7.17 6.5 8 6.5C8.83 6.5 9.5 7.17 9.5 8C9.5 8.83 8.83 9.5 8 9.5C7.17 9.5 6.5 8.83 6.5 8ZM8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11C9.66 11 11 9.66 11 8C11 6.34 9.66 5 8 5Z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M4 8C4 8.83 3.33 9.5 2.5 9.5C1.67 9.5 1 8.83 1 8C1 7.17 1.67 6.5 2.5 6.5C3.33 6.5 4 7.17 4 8ZM9.5 8C9.5 8.83 8.83 9.5 8 9.5C7.17 9.5 6.5 8.83 6.5 8C6.5 7.17 7.17 6.5 8 6.5C8.83 6.5 9.5 7.17 9.5 8ZM13.5 9.5C14.33 9.5 15 8.83 15 8C15 7.17 14.33 6.5 13.5 6.5C12.67 6.5 12 7.17 12 8C12 8.83 12.67 9.5 13.5 9.5Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M1.5 6.5C1.5 3.74 3.74 1.5 6.5 1.5C9.26 1.5 11.5 3.74 11.5 6.5C11.5 9.26 9.26 11.5 6.5 11.5C3.74 11.5 1.5 9.26 1.5 6.5ZM6.5 0C2.91 0 0 2.91 0 6.5C0 10.09 2.91 13 6.5 13C8.02 13 9.43 12.47 10.54 11.6L13.97 15.03L14.5 15.56L15.56 14.5L15.03 13.97L11.6 10.54C12.47 9.43 13 8.02 13 6.5C13 2.91 10.09 0 6.5 0Z" />
    </svg>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [importingEnv, setImportingEnv] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/vaults/${vaultId}`);
    if (!res.ok) { setError("failed_to_load"); return; }
    const data = await res.json();
    setEntries((data.entries ?? []) as Entry[]);
  }

  useEffect(() => { load(); }, [vaultId]);

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/vaults/${vaultId}/entries/${id}`, { method: "DELETE" });
    setMenuOpenId(null);
    load();
  }

  if (entries === null) {
    return <div className="px-6 py-8 text-sm text-zinc-400">Loading…</div>;
  }

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.label.toLowerCase().includes(search.toLowerCase()) ||
        (e.username ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.url ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="flex-1 flex flex-col max-w-5xl">
      <div className="px-6 py-3 flex items-center gap-4 border-b border-zinc-200">
        <Link href={`/vaults?ws=${workspaceId}`} className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 hover:text-zinc-700">← Vaults</Link>
        <span className="inline-block px-2 py-0.5 border border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-400 font-[var(--font-mono)]">
          {initialVisibility === "team" ? "Team" : "Private"}
        </span>
        <div className="relative flex items-center flex-1 max-w-xs">
          <span className="absolute left-2.5 text-zinc-400"><SearchIcon /></span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
          />
        </div>
        <span className="text-[11px] text-zinc-400 font-[var(--font-mono)] tabular-nums">{entries.length}</span>
        <div className="flex-1" />
        {initialVisibility === "private" && canManage && (
          <button onClick={() => setAccessOpen(true)} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1.5 border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400">Access</button>
        )}
        {canWrite && (
          <button onClick={() => setImportingEnv(true)} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1.5 border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400">Import .env</button>
        )}
        {canWrite && (
          <button onClick={() => { setAdding(true); setEditingId(null); }} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1.5 border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800">+ Add</button>
        )}
      </div>

      {adding && canWrite && (
        <EntryForm vaultId={vaultId} mode="create" onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      )}

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center max-w-lg mx-auto">
            <p className="text-sm text-zinc-500">{entries.length === 0 ? "No entries yet." : "No matches."}</p>
          </div>
        ) : (
          <div>
            {filtered.map((e) =>
              editingId === e.id && canWrite ? (
                <EntryForm key={e.id} vaultId={vaultId} mode="edit" entry={e} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); load(); }} />
              ) : (
                <EntryRow
                  key={e.id}
                  entry={e}
                  vaultId={vaultId}
                  canWrite={canWrite}
                  menuOpen={menuOpenId === e.id}
                  onToggleMenu={() => setMenuOpenId(menuOpenId === e.id ? null : e.id)}
                  onEdit={() => { setMenuOpenId(null); setEditingId(e.id); }}
                  onDelete={() => deleteEntry(e.id)}
                  closeMenu={() => setMenuOpenId(null)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {accessOpen && <VaultAccessPanel vaultId={vaultId} onClose={() => setAccessOpen(false)} />}
      {importingEnv && canWrite && <EnvImportModal vaultId={vaultId} onClose={() => setImportingEnv(false)} onImported={() => { setImportingEnv(false); load(); }} />}
      {error && <div className="px-6 py-3 text-xs text-rose-700 font-[var(--font-mono)]">{error}</div>}
    </div>
  );
}

function EntryRow({
  entry, vaultId, canWrite, menuOpen, onToggleMenu, onEdit, onDelete, closeMenu,
}: {
  entry: Entry; vaultId: string; canWrite: boolean;
  menuOpen: boolean; onToggleMenu: () => void;
  onEdit: () => void; onDelete: () => void; closeMenu: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [menuOpen, closeMenu]);

  async function reveal() {
    const res = await fetch(`/api/vaults/${vaultId}/entries/${entry.id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.secret !== "string") return;
    setRevealed(data.secret);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRevealed(null), 10_000);
  }

  async function copySecret() {
    if (revealed) { navigator.clipboard?.writeText(revealed).catch(() => {}); flash(); return; }
    const res = await fetch(`/api/vaults/${vaultId}/entries/${entry.id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.secret === "string") { navigator.clipboard?.writeText(data.secret).catch(() => {}); flash(); }
  }

  function copyLabel() {
    navigator.clipboard?.writeText(entry.label).catch(() => {});
    flash();
  }

  function flash() { setCopied(true); setTimeout(() => setCopied(false), 1200); }

  return (
    <div ref={rowRef} className="flex items-center gap-0 border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors min-h-[52px]">
      <div className="w-12 shrink-0 flex items-center justify-center">
        <CodeIcon />
      </div>
      <div className="flex-1 min-w-0 py-2.5 pr-4">
        <button onClick={copyLabel} className="text-[13px] font-[var(--font-mono)] text-zinc-900 hover:text-zinc-700 truncate block w-full text-left">
          {entry.label}
          {copied && <span className="ml-2 text-[10px] text-zinc-400 normal-case">Copied</span>}
        </button>
        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
          {[entry.kind.replace("_", " "), entry.username, entry.url].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 pr-2">
        {entry.has_secret && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); if (revealed) { setRevealed(null); if (timer.current) clearTimeout(timer.current); } else reveal(); }}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100"
              title={revealed ? "Hide" : "Reveal"}
            >
              <EyeIcon />
            </button>
            <span className="text-[13px] font-[var(--font-mono)] text-zinc-900 select-all">
              {revealed ?? <span className="text-zinc-400 tracking-widest">••••••••</span>}
            </span>
            <button onClick={(e) => { e.stopPropagation(); copySecret(); }} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 hover:text-zinc-700 px-1">Copy</button>
          </>
        )}
      </div>
      <div className="shrink-0 w-28 text-right pr-2">
        <span className="text-[11px] text-zinc-400">Updated {new Date(entry.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
      {canWrite && (
        <div className="shrink-0 w-10 flex items-center justify-center relative">
          <button onClick={(e) => { e.stopPropagation(); onToggleMenu(); }} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100">
            <DotsIcon />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-zinc-200 shadow-sm z-20 py-1">
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-full text-left px-3 py-1.5 text-[12px] text-zinc-700 hover:bg-zinc-50">Edit</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full text-left px-3 py-1.5 text-[12px] text-rose-600 hover:bg-rose-50">Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryForm({
  vaultId, mode, entry, onClose, onSaved,
}: {
  vaultId: string; mode: "create" | "edit"; entry?: Entry; onClose: () => void; onSaved: () => void;
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
    setBusy(true); setErr(null);
    try {
      const endpoint = mode === "create" ? `/api/vaults/${vaultId}/entries` : `/api/vaults/${vaultId}/entries/${entry!.id}`;
      const body: Record<string, unknown> = { kind, label: label.trim(), username: username.trim(), url: url.trim(), notes };
      if (secret.length > 0) body.secret = secret;
      const res = await fetch(endpoint, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "save_failed"); return; }
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/40">
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-1">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="col-span-5">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="STRIPE_SECRET_KEY" className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]" />
        </div>
        <div className="col-span-3">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ops@company.com" className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]" />
        </div>
        <div className="col-span-3">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://dashboard.stripe.com" className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700" />
        </div>
        <div className="col-span-3">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">
            Secret {mode === "edit" && entry?.has_secret && <span className="text-zinc-300 normal-case tracking-normal">(blank = keep)</span>}
          </label>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" placeholder={mode === "edit" && entry?.has_secret ? "unchanged" : "Paste here"} className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)]" />
        </div>
        <div className="col-span-3">
          <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">Notes</label>
          <input value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Context for the AI agent" className="w-full px-2 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700" />
        </div>
      </div>
      {err && <div className="mt-2 text-xs text-rose-700 font-[var(--font-mono)]">{err}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={busy || !label.trim()} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? "Saving…" : mode === "create" ? "Add" : "Save"}</button>
        <button type="button" onClick={onClose} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-zinc-900">Cancel</button>
      </div>
    </form>
  );
}

function EnvImportModal({ vaultId, onClose, onImported }: { vaultId: string; onClose: () => void; onImported: () => void }) {
  const [content, setContent] = useState("");
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Array<{ key: string; value: string }> | null>(null);

  useEffect(() => { setPreview(content.trim() ? parseEnv(content) : null); }, [content]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/import-env`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, prefix: prefix.trim() }) });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "import_failed"); return; }
      onImported();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[520px] max-h-[90vh] bg-white border border-zinc-200 shadow-sm overflow-y-auto">
        <header className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Import .env</h2>
          <button onClick={onClose} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 hover:text-zinc-700">Close</button>
        </header>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">.env content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder={`DATABASE_URL=postgres://...\nSTRIPE_SECRET_KEY=sk_live_...`} className="w-full px-2.5 py-1.5 border border-zinc-200 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-[var(--font-mono)]" />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] mb-1">Key prefix</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. BESTrong_" className="w-full px-2.5 py-1.5 border border-zinc-200 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-[var(--font-mono)]" />
          </div>
          {preview && preview.length > 0 && (
            <div className="border border-zinc-200 max-h-32 overflow-y-auto divide-y divide-zinc-100">
              {preview.slice(0, 15).map((p, i) => (
                <div key={i} className="px-2.5 py-1 flex items-center gap-2 text-xs font-[var(--font-mono)]">
                  <span className="text-zinc-900 font-medium">{prefix.trim()}{p.key}</span>
                  <span className="text-zinc-300">=</span>
                  <span className="text-zinc-400 truncate">{p.value.length > 40 ? p.value.slice(0, 40) + "…" : p.value}</span>
                </div>
              ))}
              {preview.length > 15 && <div className="px-2.5 py-1 text-[10px] text-zinc-400 font-[var(--font-mono)]">…and {preview.length - 15} more</div>}
            </div>
          )}
          {err && <div className="text-xs text-rose-700 font-[var(--font-mono)]">{err}</div>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || !content.trim()} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? "Importing…" : `Import ${preview?.length ?? 0}`}</button>
            <button type="button" onClick={onClose} className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-zinc-900">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function parseEnv(text: string) {
  const result: Array<{ key: string; value: string }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key) result.push({ key, value });
  }
  return result;
}
