import { LogoMark } from "@/components/Logo";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Slackmap",
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-[var(--paper)] text-zinc-900 min-h-screen">
      <div className="border-b border-zinc-200 px-8 py-4 flex items-center gap-3">
        <Link href="/" aria-label="Slackmap">
          <LogoMark size={28} />
        </Link>
        <span className="text-sm text-zinc-500">/ Terms of Service</span>
      </div>

      <article className="max-w-2xl mx-auto px-8 py-16 space-y-10 text-sm leading-relaxed text-zinc-700">
        <h1 className="text-3xl font-[var(--font-serif)] text-zinc-900">
          Terms of Service
        </h1>
        <p className="text-zinc-500 text-xs">
          Last updated: May 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            1. Acceptance of terms
          </h2>
          <p>
            By accessing or using Slackmap, you agree to be bound by these Terms
            of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            2. Description of service
          </h2>
          <p>
            Slackmap connects to your workplace tools (Slack, Freshdesk, and
            others) and uses AI to extract and organise company knowledge into
            skills files, people profiles, glossary entries, and a vault for
            credential management.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            3. User responsibilities
          </h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              You must have the necessary permissions to connect your
              workspace&apos;s Slack or other third-party accounts.
            </li>
            <li>
              You are responsible for the accuracy and legality of data stored
              in the Vault feature.
            </li>
            <li>
              You must not use the service to extract or store data in violation
              of any applicable laws or third-party terms of service.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            4. Intellectual property
          </h2>
          <p>
            Slackmap is open-source software. The knowledge extracted from your
            workspace remains your property. You retain full ownership of all
            data you provide and all content generated from it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            5. Data and privacy
          </h2>
          <p>
            Your use of Slackmap is also governed by our{" "}
            <Link href="/privacy" className="underline hover:text-zinc-900">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            6. Disclaimer of warranties
          </h2>
          <p>
            Slackmap is provided &quot;as is&quot; without warranty of any kind. We do
            not guarantee that the service will be uninterrupted, secure, or
            error-free. AI-generated content may contain inaccuracies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            7. Limitation of liability
          </h2>
          <p>
            In no event shall Slackmap or its contributors be liable for any
            indirect, incidental, special, or consequential damages arising out
            of your use of the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">
            8. Changes to terms
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the
            service after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">9. Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
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
        <Link href="/terms" className="text-zinc-800 font-medium">
          Terms of Service
        </Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-zinc-800">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
