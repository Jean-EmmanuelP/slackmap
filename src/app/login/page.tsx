"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const origin = window.location.origin;
      const callback = new URL("/api/auth/callback", origin);
      if (next) callback.searchParams.set("next", next);
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
      // On success, the browser is redirected by Supabase — no code here runs.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-zinc-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-3">
            Slackmap
          </span>
          <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-xs">
            Use your Google account. New here? Ask a teammate to send you an
            invite link, or install the Slack app to create a workspace.
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full h-11 inline-flex items-center justify-center gap-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed border border-[var(--brand)] hover:border-[var(--brand-hover)] transition-colors"
        >
          <GoogleGlyph />
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 text-xs text-red-700 text-center font-[var(--font-mono)]">
            {error}
          </p>
        )}

        <div className="mt-10 text-center text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
          By continuing you agree to use Slackmap with your team&apos;s data.
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#fff"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#fff"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86a5.36 5.36 0 0 1-5.04-3.71H.96v2.34A9 9 0 0 0 9 18Z"
        opacity=".85"
      />
      <path
        fill="#fff"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3-2.34Z"
        opacity=".7"
      />
      <path
        fill="#fff"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.34A5.36 5.36 0 0 1 9 3.58Z"
        opacity=".55"
      />
    </svg>
  );
}
