"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "./Logo";
import { SolutionsShowcase } from "./SolutionsShowcase";

const fadeUp = {
  initial: { opacity: 0, y: 60 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const },
  viewport: { once: true, margin: "-80px" },
};

const fadeUpDelayed = (delay: number) => ({
  initial: { opacity: 0, y: 60 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] as const },
  viewport: { once: true, margin: "-80px" },
});

export function LandingClient({ error }: { error?: string }) {
  return (
    <div className="bg-[#f5f1ea] text-zinc-900 font-sans">
      <Nav />

      <section className="min-h-screen px-8 max-w-6xl mx-auto flex flex-col items-center justify-center text-center pt-16 pb-12">
        <motion.h1
          {...fadeUp}
          className="font-[var(--font-serif)] text-[44px] sm:text-[64px] md:text-[80px] leading-[1] tracking-tight max-w-4xl"
        >
          Your company&apos;s brain,{" "}
          <em className="font-[var(--font-serif)]">extracted from your stack.</em>
        </motion.h1>
        <motion.p
          {...fadeUpDelayed(0.15)}
          className="mt-8 max-w-2xl text-zinc-600 text-base md:text-lg"
        >
          Slack, Freshdesk, and more — pulled into one living map of how your
          company actually works. Exported as executable skills your AI agents
          can run.
        </motion.p>
        <motion.div
          {...fadeUpDelayed(0.25)}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors text-base"
          >
            Get started
          </Link>
          <div className="text-xs text-zinc-500 mt-2">
            Available connectors:
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Slack</span>
            <span className="ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Freshdesk</span>
            <span className="ml-1 text-zinc-400">· Notion, Linear, Github coming soon</span>
          </div>
        </motion.div>
        {error && (
          <p className="mt-6 text-sm text-rose-600">
            {decodeURIComponent(error)}
          </p>
        )}
      </section>

      <Section>
        <motion.p
          {...fadeUp}
          className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6"
        >
          The problem
        </motion.p>
        <motion.h2
          {...fadeUpDelayed(0.05)}
          className="font-[var(--font-serif)] text-4xl md:text-6xl leading-[1.05] max-w-4xl"
        >
          The biggest blocker to AI automation
          <br />
          <em className="font-[var(--font-serif)] text-zinc-500">
            isn&apos;t the models anymore.
          </em>
        </motion.h2>
        <motion.div
          {...fadeUpDelayed(0.2)}
          className="mt-12 max-w-xl space-y-4 text-zinc-700 text-lg leading-relaxed"
        >
          <p>It&apos;s the domain knowledge.</p>
          <p className="text-zinc-500">
            Every company has critical know-how scattered everywhere — in
            people&apos;s heads, old Slack threads, support tickets. Humans
            vaguely remember where it lives.
          </p>
          <p className="text-zinc-500">
            AI agents can&apos;t operate like that.
          </p>
        </motion.div>
      </Section>

      <SolutionsShowcase
        solutions={[
          {
            number: "01",
            eyebrow: "Atlas",
            title: (
              <>
                Every channel,{" "}
                <em className="font-[var(--font-serif)] text-zinc-500">
                  what it&apos;s actually for.
                </em>
              </>
            ),
            description:
              "A live map of every channel — purpose extracted from observed activity, not from the channel name.",
            card: <AtlasPreview />,
          },
          {
            number: "02",
            eyebrow: "People",
            title: (
              <>
                Every employee,{" "}
                <em className="font-[var(--font-serif)] text-zinc-500">
                  what they actually do.
                </em>
              </>
            ),
            description:
              "AI-extracted profile per person — role, tools, expertise — inferred from how they show up in Slack.",
            card: <PeoplePreview />,
          },
          {
            number: "03",
            eyebrow: "Glossary",
            title: (
              <>
                Every acronym,{" "}
                <em className="font-[var(--font-serif)] text-zinc-500">defined.</em>
              </>
            ),
            description:
              "ARR, P0, ICP, NDR, CAC — internal jargon, defined from context, with citations back to the threads.",
            card: <GlossaryPreview />,
          },
          {
            number: "04",
            eyebrow: "Skills",
            title: (
              <>
                Every procedure,{" "}
                <em className="font-[var(--font-serif)] text-zinc-500">
                  executable by AI.
                </em>
              </>
            ),
            description:
              "Refunds, deploys, incidents, escalations — extracted as Claude-skill-compatible files. Drop them in any AI agent and it can act with your company's rules, with citations back to Slack.",
            card: <SkillPreview />,
          },
        ]}
      />

      <section id="open-source">
      <Section>
        <motion.p
          {...fadeUp}
          className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6"
        >
          Open source
        </motion.p>
        <motion.h2
          {...fadeUpDelayed(0.05)}
          className="font-[var(--font-serif)] text-4xl md:text-6xl leading-[1.05] max-w-3xl"
        >
          Self-host.{" "}
          <em className="font-[var(--font-serif)] text-zinc-500">
            Bring your own keys.
          </em>
        </motion.h2>
        <motion.p
          {...fadeUpDelayed(0.15)}
          className="mt-8 max-w-md text-zinc-600 text-base"
        >
          Fork the repo, deploy on Vercel, point at your own Supabase. Your
          Slack data never leaves your infrastructure.
        </motion.p>
      </Section>
      </section>

      <Section center>
        <motion.h2
          {...fadeUp}
          className="font-[var(--font-serif)] text-5xl md:text-7xl leading-[1.05] max-w-3xl"
        >
          Stop losing knowledge
          <br />
          <em className="font-[var(--font-serif)] text-zinc-500">
            to bus factor.
          </em>
        </motion.h2>
        <motion.div {...fadeUpDelayed(0.2)} className="mt-12 flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-800 text-base"
          >
            Get started
          </Link>
        </motion.div>
      </Section>

      <footer className="border-t border-zinc-200 px-8 py-10 text-xs text-zinc-500 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <span>Slackmap — open-source Company Brain</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-zinc-800">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-800">Terms of Service</a>
            <a
              href="https://github.com/Jean-EmmanuelP/slackmap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-800"
            >
              GitHub →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 relative flex items-center justify-center px-6 py-4 bg-[var(--paper)]/80 backdrop-blur border-b border-zinc-200/60">
      <div className="flex w-full max-w-[1400px] items-center gap-10">
        <div className="flex flex-1 items-center justify-end gap-8 text-sm text-zinc-600">
          <a href="#problem" className="hover:text-zinc-900">
            Problem
          </a>
          <a href="#solutions" className="hover:text-zinc-900">
            Solutions
          </a>
        </div>
        <a href="/" className="shrink-0" aria-label="Slackmap">
          <LogoMark size={40} />
        </a>
        <div className="flex flex-1 items-center justify-start gap-8 text-sm text-zinc-600">
          <a href="#open-source" className="hover:text-zinc-900">
            Open source
          </a>
          <a
            href="https://github.com/Jean-EmmanuelP/slackmap"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900"
          >
            GitHub
          </a>
        </div>
      </div>
      <Link
        href="/login"
        className="absolute right-6 text-sm bg-zinc-900 text-white px-5 py-2 rounded-full hover:bg-zinc-800 font-medium"
      >
        Sign in
      </Link>
    </nav>
  );
}

function Section({
  children,
  center = false,
  reverse = false,
}: {
  children: ReactNode;
  center?: boolean;
  reverse?: boolean;
}) {
  return (
    <section
      className={`min-h-screen px-8 py-32 max-w-6xl mx-auto flex flex-col ${
        center ? "items-center text-center justify-center" : "justify-center"
      } ${reverse ? "items-end text-right" : ""}`}
    >
      {children}
    </section>
  );
}

function CardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] border border-zinc-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-1.5 bg-zinc-50/50">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="ml-3 text-xs text-zinc-400 font-mono">slackmap.io</span>
      </div>
      {children}
    </div>
  );
}

function AtlasPreview() {
  const channels = [
    { name: "eng", cat: "eng", purpose: "Backend deploys, on-call rotations, and PR reviews.", msgs: 1840 },
    { name: "support", cat: "support", purpose: "Customer bugs, refund requests, triage handoffs.", msgs: 2150 },
    { name: "incidents", cat: "eng", purpose: "P0/P1 war room — alert triage, root cause, post-mortem.", msgs: 380, priv: true },
    { name: "leadership", cat: "ops", purpose: "Strategic decisions, hiring, fundraising.", msgs: 240, priv: true },
  ];
  const colors: Record<string, string> = {
    eng: "bg-blue-100 text-blue-700",
    support: "bg-emerald-100 text-emerald-700",
    ops: "bg-amber-100 text-amber-700",
  };
  return (
    <CardFrame>
      <div className="divide-y divide-zinc-100">
        {channels.map((c) => (
          <div key={c.name} className="px-5 py-3.5 flex items-start gap-3">
            <span className="text-zinc-400 mt-0.5 w-4">{c.priv ? "🔒" : "#"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-zinc-900 text-sm">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[c.cat]}`}>{c.cat}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{c.purpose}</p>
            </div>
            <span className="text-xs text-zinc-400 tabular-nums">{c.msgs.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function PeoplePreview() {
  const people = [
    { name: "Sarah Kim", role: "CEO", tools: ["Notion", "Stripe", "Pitch"], color: "bg-rose-200" },
    { name: "Marc Petit", role: "CTO", tools: ["GitHub", "Datadog", "AWS"], color: "bg-blue-200" },
    { name: "Lisa Chen", role: "Head of Support", tools: ["Zendesk", "Linear"], color: "bg-emerald-200" },
  ];
  return (
    <CardFrame>
      <div className="divide-y divide-zinc-100">
        {people.map((p) => (
          <div key={p.name} className="px-5 py-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full ${p.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-zinc-900 text-sm">{p.name}</span>
                <span className="text-xs text-zinc-500">{p.role}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.tools.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function GlossaryPreview() {
  const terms = [
    { term: "ARR", def: "Annual Recurring Revenue — sum of active subscriptions annualized." },
    { term: "P0", def: "Severity 0 incident — production down, all hands stop." },
    { term: "ICP", def: "Ideal Customer Profile — B2B SaaS, 50-500 employees." },
    { term: "NDR", def: "Net Dollar Retention — target 115%." },
  ];
  return (
    <CardFrame>
      <div className="divide-y divide-zinc-100">
        {terms.map((t) => (
          <div key={t.term} className="px-5 py-3 flex items-start gap-4">
            <span className="font-mono text-sm font-medium text-zinc-900 w-12 shrink-0">{t.term}</span>
            <span className="text-xs text-zinc-600 leading-relaxed">{t.def}</span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function SkillPreview() {
  return (
    <CardFrame>
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/40">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            process
          </span>
          <span className="text-xs text-zinc-500">handle-customer-refund.skill.md</span>
        </div>
        <p className="font-medium text-zinc-900 text-sm mt-2">Handle a customer refund request</p>
      </div>
      <div className="px-5 py-4 space-y-3 text-xs leading-relaxed">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Trigger</p>
          <p className="text-zinc-700">When a customer asks for a refund (Zendesk, Slack, or email).</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Steps</p>
          <ol className="text-zinc-700 space-y-1 list-decimal list-inside">
            <li>Verify the order in Stripe Dashboard.</li>
            <li>If amount &lt; $500 and within 30 days: refund directly.</li>
            <li>If $500–$2,000: ping @lisa for approval.</li>
            <li>If &gt; $2,000 or beyond 30 days: escalate to @sarah.</li>
          </ol>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Sources</p>
          <p className="text-zinc-500 italic">
            #support · &ldquo;refund policy clarified — 30 day window…&rdquo; ↗
          </p>
        </div>
      </div>
      <div className="px-5 py-3 bg-zinc-900 text-zinc-400 text-[11px] font-mono flex items-center justify-between">
        <span>confidence 92% · 7 sources</span>
        <span className="text-emerald-400">⬇ export</span>
      </div>
    </CardFrame>
  );
}
