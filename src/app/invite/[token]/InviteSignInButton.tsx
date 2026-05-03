"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function InviteSignInButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const origin = window.location.origin;
      const callback = new URL("/api/auth/callback", origin);
      callback.searchParams.set("next", `/invite/${token}`);
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full h-11 inline-flex items-center justify-center gap-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed border border-[var(--brand)] hover:border-[var(--brand-hover)] transition-colors"
      >
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && (
        <p className="text-xs text-red-700 font-[var(--font-mono)]">{error}</p>
      )}
    </div>
  );
}
