"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

const COOKIE = "slackmap.lang";

function readCookie(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return match?.[1] ?? "en";
}

function writeCookie(value: string) {
  // 365-day expiry, cross-page, non-http-only (read by JS).
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Compact language switcher. Defaults the available choices to English + the
 * workspace's secondary language (avoid overwhelming a UI when most teams
 * only need a single toggle). The full list lives in SUPPORTED_LANGUAGES if
 * we want to expose more later.
 */
export function LanguageToggle({
  workspaceLang,
  collapsed = false,
}: {
  workspaceLang: string;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string>("en");

  useEffect(() => {
    const initial = readCookie();
    // First mount: if no cookie yet, adopt the workspace default.
    setActive(initial && initial !== "en" ? initial : workspaceLang === "en" ? "en" : initial || workspaceLang);
  }, [workspaceLang]);

  // Choices = English (canonical) + workspace's secondary language.
  // For en-only workspaces, hide the toggle entirely (nothing to switch to).
  if (workspaceLang === "en") return null;

  const secondary = SUPPORTED_LANGUAGES.find((l) => l.code === workspaceLang);
  if (!secondary) return null;

  function setLang(code: string) {
    setActive(code);
    writeCookie(code);
    router.refresh();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setLang(active === "en" ? secondary!.code : "en")}
        title={`Switch to ${active === "en" ? secondary!.label : "English"}`}
        className="size-6 mx-auto my-2 flex items-center justify-center border border-zinc-200 text-[10px] font-[var(--font-mono)] uppercase text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
      >
        {active === "en" ? "EN" : secondary.code.toUpperCase()}
      </button>
    );
  }

  return (
    <div className="px-2 py-2 flex items-center gap-1 border-t border-zinc-200">
      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mr-1">
        Lang
      </span>
      <div className="flex border border-zinc-200">
        <button
          type="button"
          onClick={() => setLang("en")}
          className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 ${
            active === "en"
              ? "bg-zinc-900 text-[var(--paper)]"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLang(secondary.code)}
          className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-0.5 border-l border-zinc-200 ${
            active === secondary.code
              ? "bg-zinc-900 text-[var(--paper)]"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {secondary.code.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
