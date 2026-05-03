"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "./Logo";

export function Nav({ workspaceName, workspaceId }: { workspaceName: string; workspaceId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = [
    { href: `/atlas?ws=${workspaceId}`, key: "/atlas", label: "Atlas" },
    { href: `/people?ws=${workspaceId}`, key: "/people", label: "People" },
    { href: `/glossary?ws=${workspaceId}`, key: "/glossary", label: "Glossary" },
    { href: `/skills?ws=${workspaceId}`, key: "/skills", label: "Skills" },
  ];

  async function logout() {
    if (!confirm("Disconnect from this Slack workspace? Your data stays in the DB.")) return;
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <nav className="relative flex items-center px-6 py-4 border-b border-zinc-200 bg-[var(--paper)]/80 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Slackmap"><LogoMark size={32} /></Link>
        <span className="text-sm text-zinc-500">/ {workspaceName}</span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-1">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
              pathname.startsWith(t.key)
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <button
        onClick={logout}
        className="ml-auto text-sm text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-full hover:bg-zinc-100"
      >
        Disconnect Slack
      </button>
    </nav>
  );
}
