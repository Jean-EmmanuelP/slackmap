"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavItem = {
  href: string;
  key: string;
  label: string;
  icon: ReactNode;
};

const ICON = "size-4 shrink-0 text-zinc-500 group-hover:text-zinc-900";

const HomeIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={ICON} stroke="currentColor" strokeWidth="1.4">
    <path d="M2 7.5 8 2.5l6 5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Z" />
    <path d="M6.5 14V9.5h3V14" />
  </svg>
);
const AtlasIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={ICON} stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="2" width="5" height="5" />
    <rect x="9" y="2" width="5" height="5" />
    <rect x="2" y="9" width="5" height="5" />
    <rect x="9" y="9" width="5" height="5" />
  </svg>
);
const PeopleIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={ICON} stroke="currentColor" strokeWidth="1.4">
    <circle cx="6" cy="6" r="2.5" />
    <path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
    <circle cx="11.5" cy="6.5" r="2" />
    <path d="M9.5 13c0-1.6 1.4-2.5 3-2.5s2.5.9 2.5 2.5" />
  </svg>
);
const SkillsIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={ICON} stroke="currentColor" strokeWidth="1.4">
    <path d="M3 3h10v3H3zM3 7h10v3H3zM3 11h6v3H3z" />
  </svg>
);
const GlossaryIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={ICON} stroke="currentColor" strokeWidth="1.4">
    <path d="M3 2h8a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V2Z" />
    <path d="M3 12a2 2 0 0 1 2-2h8" />
  </svg>
);

export function WorkspaceShell({
  workspaceName,
  workspaceId,
  workspaceIconUrl,
  children,
}: {
  workspaceName: string;
  workspaceId: string;
  workspaceIconUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const knowledge: NavItem[] = [
    { href: `/atlas?ws=${workspaceId}`, key: "/atlas", label: "Atlas", icon: <AtlasIcon /> },
    { href: `/people?ws=${workspaceId}`, key: "/people", label: "People", icon: <PeopleIcon /> },
    { href: `/skills?ws=${workspaceId}`, key: "/skills", label: "Skills", icon: <SkillsIcon /> },
    { href: `/glossary?ws=${workspaceId}`, key: "/glossary", label: "Glossary", icon: <GlossaryIcon /> },
  ];

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function doDisconnect() {
    setDisconnecting(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-zinc-900 flex">
      <aside
        className={`${
          collapsed ? "w-14" : "w-60"
        } shrink-0 border-r border-zinc-200 flex flex-col transition-[width] duration-150 bg-[var(--paper)] sticky top-0 h-screen`}
      >
        {/* Workspace switcher */}
        <div className="flex items-center gap-2.5 px-3 py-3 border-b border-zinc-200">
          <Link
            href={`/home?ws=${workspaceId}`}
            aria-label="Home"
            className="shrink-0"
          >
            <WorkspaceIcon name={workspaceName} url={workspaceIconUrl} />
          </Link>
          {!collapsed && (
            <span className="flex-1 text-[13px] font-medium text-zinc-900 truncate">
              {workspaceName}
            </span>
          )}
        </div>

        {/* Home */}
        <div className="px-2 pt-3">
          <NavLink
            href={`/home?ws=${workspaceId}`}
            label="Home"
            icon={<HomeIcon />}
            collapsed={collapsed}
            active={pathname.startsWith("/home")}
          />
        </div>

        {/* Knowledge group */}
        <div className="px-2 mt-5">
          {!collapsed && (
            <div className="px-2 mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              Knowledge
            </div>
          )}
          <nav className="flex flex-col gap-px">
            {knowledge.map((t) => (
              <NavLink
                key={t.key}
                href={t.href}
                label={t.label}
                icon={t.icon}
                collapsed={collapsed}
                active={pathname.startsWith(t.key)}
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-zinc-200 px-2 py-2 flex items-center justify-between">
          {!collapsed && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-900 px-2 py-1 font-[var(--font-mono)]"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Toggle sidebar"
            className="ml-auto text-zinc-500 hover:text-zinc-900 size-6 flex items-center justify-center border border-zinc-200 hover:border-zinc-400"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[var(--paper)]">
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[420px] bg-[var(--paper)] border border-zinc-300 p-6">
            <h3 className="text-lg font-medium text-zinc-900">Disconnect Slack?</h3>
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
              You&apos;ll be signed out of this workspace. Your extracted skills, people, and
              glossary stay in the database — reconnect later to pick up where you left off.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={disconnecting}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={doDisconnect}
                disabled={disconnecting}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceIcon({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        width={28}
        height={28}
        className="size-7 object-cover border border-zinc-200"
      />
    );
  }
  const initial = (name?.trim()[0] ?? "·").toUpperCase();
  return (
    <span className="size-7 flex items-center justify-center bg-zinc-900 text-[var(--paper)] text-xs font-medium font-[var(--font-mono)]">
      {initial}
    </span>
  );
}

function NavLink({
  href,
  label,
  icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 px-2 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-900"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/60"
      }`}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
