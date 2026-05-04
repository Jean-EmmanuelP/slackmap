"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { LogoMark } from "@/components/Logo";

function AuthInner() {
  const search = useSearchParams();
  const next = search.get("next") ?? null;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState<"google" | "linkedin" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  function callbackUrl(): string {
    const origin = window.location.origin;
    const callback = new URL("/api/auth/callback", origin);
    if (next) callback.searchParams.set("next", next);
    return callback.toString();
  }

  async function handleOAuth(provider: "google" | "linkedin_oidc") {
    const key = provider === "google" ? "google" : "linkedin";
    setLoading(key);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOAuth({
        provider,
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

  async function handleSubmit(e: React.FormEvent) {
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

  const isSignUp = mode === "signup";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--paper)] text-zinc-900 px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="border border-zinc-200/60 bg-white/60 backdrop-blur-sm shadow-sm p-8">
          <div className="flex flex-col items-center text-center mb-7">
            <a href="/" aria-label="Slackmap">
              <LogoMark size={36} />
            </a>
            <h1 className="mt-5 text-lg font-semibold text-zinc-900 tracking-tight">
              {isSignUp ? "Create your account" : "Sign in to Slackmap"}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              {isSignUp
                ? "Welcome! Fill in your email to get started."
                : "Welcome back! Please sign in to continue."}
            </p>
          </div>

          {emailSent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6.25 10L8.75 12.5L13.75 7.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm text-zinc-700">
                We sent a magic link to{" "}
                <span className="font-medium text-zinc-900">{email}</span>.
              </p>
              <p className="text-xs text-zinc-500">
                Open it to finish signing in. You can close this tab.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleOAuth("google")}
                  disabled={loading !== null}
                  className="h-10 inline-flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg text-sm font-medium text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <GoogleGlyph />
                  {loading === "google" ? "…" : "Google"}
                </button>
                <button
                  onClick={() => handleOAuth("linkedin_oidc")}
                  disabled={loading !== null}
                  className="h-10 inline-flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg text-sm font-medium text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <LinkedInGlyph />
                  {loading === "linkedin" ? "…" : "LinkedIn"}
                </button>
              </div>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="email-field"
                    className="block text-sm text-zinc-700 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email-field"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-shadow"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading !== null || !email.trim()}
                  className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {loading === "email" ? (
                    "Sending…"
                  ) : (
                    <>
                      Continue
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {error && (
            <p className="mt-4 text-xs text-rose-600 text-center">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-zinc-500">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("signin"); setError(null); setEmailSent(false); }}
                className="text-zinc-900 font-medium hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); setEmailSent(false); }}
                className="text-zinc-900 font-medium hover:underline"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function LinkedInGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2"/>
    </svg>
  );
}
