import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NoWorkspacePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-zinc-900 px-6">
      <div className="w-full max-w-md text-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
          Slackmap
        </span>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">
          You&apos;re signed in — but you&apos;re not on a workspace yet
        </h1>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
          To start using Slackmap, either ask a teammate for an invite link, or
          install the Slack app to create your own workspace and become its
          admin.
        </p>

        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/"
            className="h-11 inline-flex items-center justify-center bg-zinc-900 text-[var(--paper)] text-sm font-medium hover:bg-zinc-800"
          >
            Install Slack &amp; create a workspace
          </Link>
          <Link
            href="/login"
            className="h-11 inline-flex items-center justify-center border border-zinc-300 hover:border-zinc-500 text-sm text-zinc-700 hover:text-zinc-900"
          >
            Switch Google account
          </Link>
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
          Have an invite link? Paste it in your address bar.
        </p>
      </div>
    </main>
  );
}
