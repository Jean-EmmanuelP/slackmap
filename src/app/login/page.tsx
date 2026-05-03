"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { LogoMark } from "@/components/Logo";

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") ?? null;
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  function callbackUrl(): string {
    const origin = window.location.origin;
    const callback = new URL("/api/auth/callback", origin);
    if (next) callback.searchParams.set("next", next);
    return callback.toString();
  }

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (error) {
        setError(error.message);
        setLoading(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(null);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) {
        setError(error.message);
        setLoading(null);
      } else {
        setEmailSent(true);
        setLoading(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--paper)] text-zinc-900 px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="font-[var(--font-mono)] text-3xl md:text-4xl tracking-tight text-zinc-900">
          Welcome back
        </h1>
        <p className="mt-3 text-sm text-zinc-500 font-[var(--font-mono)]">
          Sign in to continue to your workspace
        </p>
      </div>

      <div className="w-full max-w-md border border-zinc-200 p-8 bg-[var(--paper)]">
        <div className="flex flex-col items-center text-center mb-6">
          <LogoMark size={44} />
          <h2 className="mt-4 text-lg font-medium text-zinc-900">Sign in to Slackmap</h2>
          <p className="mt-1 text-sm text-zinc-500">Welcome back! Please sign in to continue.</p>
        </div>

        {emailSent ? (
          <div className="border border-zinc-300 p-4 text-sm text-zinc-700">
            Magic link sent to <span className="font-[var(--font-mono)]">{email}</span>. Open it to
            finish signing in. You can close this tab.
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading !== null}
              className="w-full h-11 inline-flex items-center justify-center gap-2.5 border border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100 text-sm font-medium text-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <GoogleGlyph />
              {loading === "google" ? "Redirecting…" : "Continue with Google"}
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                or
              </span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                  Email address
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full px-3 py-2.5 bg-transparent border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </label>
              <button
                type="submit"
                disabled={loading !== null || !email.trim()}
                className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-[var(--paper)] text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading === "email" ? "Sending link…" : "Continue with email →"}
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="mt-4 text-xs text-zinc-700 text-center font-[var(--font-mono)]">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        Don&apos;t have an account?{" "}
        <span className="text-zinc-900">Ask a teammate for an invite link.</span>
      </p>
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
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
