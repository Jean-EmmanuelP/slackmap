import { LogoMark } from "@/components/Logo";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Slackmap",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[var(--paper)] text-zinc-900 min-h-screen">
      <div className="border-b border-zinc-200 px-8 py-4 flex items-center gap-3">
        <Link href="/" aria-label="Slackmap">
          <LogoMark size={28} />
        </Link>
        <span className="text-sm text-zinc-500">/ Privacy Policy</span>
      </div>

      <article className="max-w-2xl mx-auto px-8 py-16 space-y-10 text-sm leading-relaxed text-zinc-700">
        <h1 className="text-3xl font-[var(--font-serif)] text-zinc-900">
          Privacy Policy
        </h1>
        <p className="text-zinc-500 text-xs">
          Last updated: May 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">1. Who we are</h2>
          <p>
            Slackmap is an open-source application that connects to your existing
            tools (Slack, Freshdesk, and others) to extract and organise company
            knowledge. The source code is available at{" "}
            <Link
              href="https://github.com/Jean-EmmanuelP/slackmap"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900"
            >
              github.com/Jean-EmmanuelP/slackmap
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            2. What data we collect
          </h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>Slack messages and channel metadata</strong> — read via the
              official Slack API to extract skills, people profiles, and glossary
              terms.
            </li>
            <li>
              <strong>Freshdesk tickets</strong> — read via the Freshdesk API to
              extract support procedures and knowledge.
            </li>
            <li>
              <strong>Workspace information</strong> — team name, icon, and
              member list provided by Slack during OAuth.
            </li>
            <li>
              <strong>User account information</strong> — email address and
              avatar from Slack authentication.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            3. How we use your data
          </h2>
          <p>
            Your data is used exclusively to provide the Slackmap service:
            extracting, organising, and presenting company knowledge. We use
            third-party AI services (Anthropic) to process and summarise the
            extracted content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            4. Data storage and security
          </h2>
          <p>
            All data is stored in a Supabase (PostgreSQL) database. Secrets and
            credentials stored in the Vault feature are encrypted at rest using
            AES-256-GCM encryption. Access is scoped per workspace and controlled
            by role-based permissions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            5. Third-party services
          </h2>
          <p>Slackmap integrates with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>Slack</strong> — for reading workspace messages and
              metadata.
            </li>
            <li>
              <strong>Freshdesk</strong> — for reading support tickets.
            </li>
            <li>
              <strong>Anthropic</strong> — for AI-powered content extraction and
              summarisation.
            </li>
            <li>
              <strong>Supabase</strong> — for database hosting and
              authentication.
            </li>
            <li>
              <strong>Vercel</strong> — for application hosting.
            </li>
            <li>
              <strong>Google Maps Platform</strong> — for displaying location
              data. Google may collect, process, and use data as described in{" "}
              <Link
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-900"
              >
                Google&apos;s Privacy Policy
              </Link>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            6. Data retention
          </h2>
          <p>
            Your data is retained for as long as your workspace is active. You
            can request deletion of all data at any time by disconnecting your
            Slack workspace and contacting us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">7. Your rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Disconnect your Slack workspace at any time.</li>
            <li>Export your extracted knowledge (skills, people, glossary).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">8. Contact</h2>
          <p>
            For any privacy-related questions or requests, contact us at{" "}
            <Link
              href="mailto:jperrama@gmail.com"
              className="underline hover:text-zinc-900"
            >
              jperrama@gmail.com
            </Link>
            .
          </p>
        </section>
      </article>

      <footer className="border-t border-zinc-200 px-8 py-8 text-xs text-zinc-500 flex items-center justify-center gap-6">
        <Link href="/" className="hover:text-zinc-800">
          Home
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:text-zinc-800">
          Terms of Service
        </Link>
        <span>·</span>
        <Link href="/privacy" className="text-zinc-800 font-medium">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
