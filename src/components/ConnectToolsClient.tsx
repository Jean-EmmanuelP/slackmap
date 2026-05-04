"use client";

import { LogoMark } from "@/components/Logo";

export function ConnectToolsClient({ slackOAuthUrl }: { slackOAuthUrl: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-zinc-900 px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex flex-col items-center mb-8">
          <LogoMark size={44} />
        </div>

        <h1 className="text-2xl font-medium tracking-tight">
          Connect your tools
        </h1>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
          Link the tools your team uses. We&apos;ll extract knowledge automatically.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={slackOAuthUrl}
            className="w-full h-12 inline-flex items-center justify-center gap-2.5 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <SlackGlyph />
            Connect Slack
          </a>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)]">
              coming soon
            </span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <button
            disabled
            className="w-full h-12 inline-flex items-center justify-center gap-2.5 border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-400 cursor-not-allowed"
          >
            <FreshdeskGlyph />
            Connect Freshdesk
          </button>
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          You can also connect tools later from your workspace settings.
        </p>
      </div>
    </main>
  );
}

function SlackGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
    </svg>
  );
}

function FreshdeskGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
