"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Vault = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  visibility: "team" | "private";
  entry_count: number;
  updated_at: string;
};

export function VaultsList({
  workspaceId,
  isAdmin,
}: {
  workspaceId: string;
  isAdmin: boolean;
}) {
  const [vaults, setVaults] = useState<Vault[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/workspace/${workspaceId}/vaults`);
    if (!res.ok) {
      setError("failed_to_load");
      return;
    }
    const data = await res.json();
    setVaults((data.vaults ?? []) as Vault[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  if (vaults === null) {
    return (
      <div className="px-8 py-12 text-sm text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 py-4 flex items-center gap-3 border-b border-zinc-200">
        <span className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
          {vaults.length} {vaults.length === 1 ? "vault" : "vaults"}
        </span>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="ml-auto text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
          >
            + New vault
          </button>
        )}
      </div>

      {creating && isAdmin && (
        <CreateVaultForm
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {vaults.length === 0 ? (
        <div className="px-8 py-16 text-center max-w-2xl mx-auto">
          <p className="text-sm text-zinc-600 leading-relaxed">
            No vaults yet. Create one to store credentials, account URLs, and ops knowledge your AI
            skills can use.
          </p>
          {!isAdmin && (
            <p className="mt-3 text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
              Ask a workspace admin to create one.
            </p>
          )}
        </div>
      ) : (
        (() => {
          const filtered = vaults.filter((v) => {
            if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !(v.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
            if (filterCategory && v.category !== filterCategory) return false;
            return true;
          });
          const categories = [...new Set(vaults.map((v) => v.category ?? "").filter(Boolean))];
          const uncategorized = filtered.filter((v) => !v.category);
          const grouped = categories
            .filter((c) => !filterCategory || c === filterCategory)
            .map((c) => ({ category: c, vaults: filtered.filter((v) => v.category === c) }))
            .filter((g) => g.vaults.length > 0);

          return (
            <div>
              <div className="px-8 py-3 flex items-center gap-3 border-b border-zinc-200">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vaults…"
                  className="px-3 py-1.5 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 w-64"
                />
                {categories.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterCategory(null)}
                      className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border ${!filterCategory ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600 hover:border-zinc-500"}`}
                    >
                      All
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFilterCategory(filterCategory === c ? null : c)}
                        className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border ${filterCategory === c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600 hover:border-zinc-500"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)]">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {grouped.map(({ category, vaults: catVaults }) => (
                <div key={category}>
                  <div className="px-8 py-2 bg-zinc-50 border-b border-zinc-200">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] font-medium">
                      {category}
                    </span>
                  </div>
                  <VaultRows vaults={catVaults} />
                </div>
              ))}
              {uncategorized.length > 0 && (
                grouped.length > 0 ? (
                  <div>
                    <div className="px-8 py-2 bg-zinc-50 border-b border-zinc-200">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] font-medium">
                        Other
                      </span>
                    </div>
                    <VaultRows vaults={uncategorized} />
                  </div>
                ) : (
                  <VaultRows vaults={uncategorized} />
                )
              )}
              {filtered.length === 0 && (
                <div className="px-8 py-12 text-center text-sm text-zinc-500">
                  No vaults match your search.
                </div>
              )}
            </div>
          );
        })()
      )}

      {error && (
        <div className="px-8 py-3 text-xs text-rose-700 font-[var(--font-mono)]">{error}</div>
      )}
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: "team" | "private" }) {
  return (
    <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)]">
      {visibility === "team" ? "Shared with team" : "Private"}
    </span>
  );
}

function VaultRows({ vaults }: { vaults: Vault[] }) {
  return (
    <ul className="divide-y divide-zinc-200">
      {vaults.map((v) => (
        <li key={v.id}>
          <Link
            href={`/vault/${v.id}`}
            className="block px-8 py-4 hover:bg-zinc-100/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 size-8 border border-zinc-300 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className="size-4 text-zinc-500"
                >
                  <rect x="2" y="6" width="12" height="8" />
                  <path d="M5 6V4a3 3 0 0 1 6 0v2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-zinc-900 truncate">{v.name}</h3>
                  <VisibilityBadge visibility={v.visibility} />
                </div>
                {v.description && (
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-1">{v.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm tabular-nums text-zinc-900 font-[var(--font-mono)]">
                  {v.entry_count}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                  entries
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CreateVaultForm({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<"team" | "private">("team");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/vaults`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), category: category.trim() || null, visibility }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "create_failed");
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-8 py-5 border-b border-zinc-200 bg-zinc-50/40"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <div className="md:col-span-1">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Engineering credentials"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Category / Company
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Bestrong, Slackmap…"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Stripe, Shopify, AWS — what production runs on"
            className="w-full px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-1">
          Visibility
        </label>
        <div className="flex gap-4">
          <RadioCard
            checked={visibility === "team"}
            onChange={() => setVisibility("team")}
            title="Shared with team"
            sub="Any workspace member can read"
          />
          <RadioCard
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
            title="Private"
            sub="Only people you grant access to"
          />
        </div>
      </div>
      {err && (
        <div className="mt-3 text-xs text-rose-700 font-[var(--font-mono)]">
          {err === "duplicate_name" ? "A vault with that name already exists." : err}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create vault"}
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

function RadioCard({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  sub: string;
}) {
  return (
    <label
      className={`flex-1 max-w-xs flex items-start gap-3 px-3 py-2.5 border cursor-pointer transition-colors ${
        checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-500"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-zinc-900"
      />
      <span>
        <span className="block text-[12px] font-medium text-zinc-900">{title}</span>
        <span className="block text-[11px] text-zinc-500 leading-relaxed">{sub}</span>
      </span>
    </label>
  );
}
