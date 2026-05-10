"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const PeopleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const SkillsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);
const GlossaryIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <circle cx="12" cy="12" r="1" />
    <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
    <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
  </svg>
);
const AgentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);
const VaultIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={ICON}
  >
    <path d="M10 2v8l3-3 3 3V2" />
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
  </svg>
);

import { LanguageToggle } from "@/components/LanguageToggle";
import { t } from "@/lib/i18n-ui";

export function WorkspaceShell({
  workspaceName,
  workspaceId,
  workspaceIconUrl,
  workspaceLang,
  children,
}: {
  workspaceName: string;
  workspaceId: string;
  workspaceIconUrl?: string | null;
  workspaceLang?: string;
  children: ReactNode;
}) {
  // Read the cookie client-side so the sidebar nav labels react instantly to
  // the language toggle. Server-rendered initial value comes from workspaceLang.
  const lang = (typeof document !== "undefined"
    ? (document.cookie.match(/(?:^|; )slackmap\.lang=([^;]+)/)?.[1])
    : undefined) ?? workspaceLang ?? "en";
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const knowledge: NavItem[] = [
    { href: `/atlas?ws=${workspaceId}`, key: "/atlas", label: t("nav.atlas", lang), icon: <AtlasIcon /> },
    { href: `/people?ws=${workspaceId}`, key: "/people", label: t("nav.people", lang), icon: <PeopleIcon /> },
    { href: `/skills?ws=${workspaceId}`, key: "/skills", label: t("nav.skills", lang), icon: <SkillsIcon /> },
    { href: `/glossary?ws=${workspaceId}`, key: "/glossary", label: t("nav.glossary", lang), icon: <GlossaryIcon /> },
    { href: `/agent?ws=${workspaceId}`, key: "/agent", label: t("nav.agent", lang), icon: <AgentIcon /> },
    { href: `/vaults?ws=${workspaceId}`, key: "/vault", label: t("nav.vault", lang), icon: <VaultIcon /> },
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
            label={t("nav.home", lang)}
            icon={<HomeIcon />}
            collapsed={collapsed}
            active={pathname.startsWith("/home")}
          />
        </div>

        {/* Knowledge group */}
        <div className="px-2 mt-5">
          {!collapsed && (
            <div className="px-2 mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              {t("nav.knowledge", lang)}
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

        <div className="mt-auto border-t border-zinc-200">
          <SignedInUser collapsed={collapsed} />
          {workspaceLang && workspaceLang !== "en" && (
            <LanguageToggle workspaceLang={workspaceLang} collapsed={collapsed} />
          )}
          <div className="px-2 py-2 flex items-center justify-between border-t border-zinc-200">
            {!collapsed && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-900 px-2 py-1 font-[var(--font-mono)]"
              >
                {t("nav.disconnect", lang)}
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

type SessionUser = {
  email: string | null;
  avatarUrl: string | null;
};

function SignedInUser({ collapsed }: { collapsed: boolean }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const u = data.user;
      if (!u) {
        setUser(null);
        return;
      }
      const meta = (u.user_metadata ?? {}) as {
        avatar_url?: string;
        picture?: string;
      };
      setUser({
        email: u.email ?? null,
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const initial = (user.email?.trim()[0] ?? "·").toUpperCase();

  return (
    <div className="px-2 py-2 flex items-center gap-2 min-w-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.email ?? "User"}
          width={24}
          height={24}
          className="size-6 object-cover border border-zinc-200 shrink-0"
        />
      ) : (
        <span className="size-6 shrink-0 flex items-center justify-center bg-zinc-200 text-zinc-700 text-[11px] font-medium font-[var(--font-mono)]">
          {initial}
        </span>
      )}
      {!collapsed && (
        <span className="text-[11px] text-zinc-600 truncate font-[var(--font-mono)]">
          {user.email ?? "Signed in"}
        </span>
      )}
    </div>
  );
}
