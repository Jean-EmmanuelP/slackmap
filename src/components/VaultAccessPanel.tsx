"use client";

import { useEffect, useState } from "react";

type Profile = { email: string | null; name: string | null } | null;

type Grant = {
  vault_id: string;
  user_id: string;
  role: "read" | "write" | "admin";
  granted_by: string | null;
  created_at: string;
  profile: Profile;
};

type Member = {
  user_id: string;
  role: string;
  profile: Profile;
};

export function VaultAccessPanel({
  vaultId,
  onClose,
}: {
  vaultId: string;
  onClose: () => void;
}) {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pickUserId, setPickUserId] = useState("");
  const [pickRole, setPickRole] = useState<"read" | "write" | "admin">("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/vaults/${vaultId}/access`);
    if (!res.ok) {
      setErr("failed_to_load");
      return;
    }
    const data = await res.json();
    setGrants((data.grants ?? []) as Grant[]);
    setMembers((data.members ?? []) as Member[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId]);

  async function add() {
    if (!pickUserId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: pickUserId, role: pickRole }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "add_failed");
        return;
      }
      setPickUserId("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    if (!confirm("Revoke access?")) return;
    await fetch(`/api/vaults/${vaultId}/access/${userId}`, { method: "DELETE" });
    load();
  }

  const grantedIds = new Set((grants ?? []).map((g) => g.user_id));
  const eligible = members.filter((m) => !grantedIds.has(m.user_id));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-[480px] h-full bg-[var(--paper)] border-l border-zinc-300 overflow-y-auto">
        <header className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Manage access</h2>
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 hover:text-zinc-900"
          >
            Close
          </button>
        </header>

        <section className="px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-2">
            Add a teammate
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={pickUserId}
              onChange={(e) => setPickUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700"
            >
              <option value="">Select member…</option>
              {eligible.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.email ?? m.user_id}
                </option>
              ))}
            </select>
            <select
              value={pickRole}
              onChange={(e) => setPickRole(e.target.value as "read" | "write" | "admin")}
              className="px-3 py-2 border border-zinc-300 bg-transparent text-sm text-zinc-900 focus:outline-none focus:border-zinc-700 font-[var(--font-mono)] uppercase text-[11px] tracking-wider"
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={add}
              disabled={busy || !pickUserId}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-2 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {err && (
            <div className="mt-2 text-xs text-rose-700 font-[var(--font-mono)]">{err}</div>
          )}
        </section>

        <section className="px-6 py-4">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-2">
            People with access
          </h3>
          {grants === null ? (
            <div className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase">Loading…</div>
          ) : grants.length === 0 ? (
            <div className="text-xs text-zinc-500">No grants yet — only workspace admins can read this vault.</div>
          ) : (
            <ul className="divide-y divide-zinc-200 border border-zinc-200">
              {grants.map((g) => (
                <li
                  key={g.user_id}
                  className="px-3 py-2 flex items-center gap-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-900 truncate text-[13px]">
                      {g.profile?.email ?? g.user_id}
                    </div>
                  </div>
                  <span className="inline-block px-2 py-0.5 border border-zinc-300 text-[10px] uppercase tracking-wider text-zinc-600 font-[var(--font-mono)]">
                    {g.role}
                  </span>
                  <button
                    onClick={() => revoke(g.user_id)}
                    className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] text-rose-600 hover:text-rose-800"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
