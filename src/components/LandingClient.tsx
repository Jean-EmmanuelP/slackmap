"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogoLockup } from "./Logo";
import { SolutionsShowcase } from "./SolutionsShowcase";

// Davis signature easing — sine ease-in-out, calm and breathing.
// They use a small 20px translate and 0.9–1.1s duration for an unhurried feel.
const DAVIS_EASE = [0.44, 0, 0.56, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 1, ease: DAVIS_EASE },
  viewport: { once: true, margin: "-80px" },
};

const fadeUpDelayed = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 1, delay, ease: DAVIS_EASE },
  viewport: { once: true, margin: "-80px" },
});

export function LandingClient({ error }: { error?: string }) {
  return (
    <div className="bg-[#f5f1ea] text-zinc-900 font-sans">
      <TopTicker />
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
          <CTAButton href="/login">Get started</CTAButton>
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-[var(--font-mono)] uppercase tracking-[0.18em]">
            <ConnectorPill label="Slack" live />
            <ConnectorPill label="Freshdesk" live />
            <span className="mx-1 text-zinc-300">·</span>
            <ConnectorPill label="Notion" />
            <ConnectorPill label="Linear" />
            <ConnectorPill label="GitHub" />
          </div>
        </motion.div>
        {error && (
          <p className="mt-6 text-sm text-rose-600">
            {decodeURIComponent(error)}
          </p>
        )}
      </section>

      <Section>
        <Eyebrow>The problem</Eyebrow>
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
            icon: <IconAtlas />,
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
            icon: <IconPeople />,
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
            icon: <IconGlossary />,
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
            icon: <IconSkills />,
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

      <TopTeamsSection />

      <section id="open-source">
      <Section>
        <Eyebrow>Open source</Eyebrow>
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
          <CTAButton href="/login">Get started</CTAButton>
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

// Minimal icons for the solutions rows — 1.4px stroke, currentColor.
function IconAtlas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconGlossary() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h7" />
    </svg>
  );
}
function IconSkills() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// Davis "Services" pattern — adapted to slackmap. Left column: static
// heading "The top teams use Slackmap for". Right column: a vertical
// auto-scrolling list of use-cases that loops infinitely with a soft mask
// fading the top and bottom edges. Pure CSS, no JS animation.
function TopTeamsSection() {
  const useCases = [
    "Customer support automation",
    "Engineering onboarding",
    "AI agent grounding",
    "Knowledge audits",
    "Compliance documentation",
    "Sales enablement",
    "Refund & escalation playbooks",
    "Incident response",
    "Internal jargon explainers",
  ];
  // Repeat the list so the marquee can loop seamlessly via translateY(-50%).
  const repeated = [...useCases, ...useCases];

  return (
    <section
      id="use-cases"
      className="relative bg-[var(--paper)] py-24 md:py-32"
    >
      <div className="max-w-6xl mx-auto px-8 grid md:grid-cols-2 gap-16 items-center">
        {/* Left: heading only — no eyebrow. Vertically centered with the
            active middle item on the right (Davis pattern). */}
        <motion.h2
          {...fadeUp}
          className="font-[var(--font-serif)] text-4xl md:text-5xl leading-[1.1] tracking-tight max-w-md"
        >
          The top teams use{" "}
          <em className="font-[var(--font-serif)] text-zinc-500">Slackmap</em>{" "}
          for
        </motion.h2>

        {/* Right: vertical marquee. Two synchronized scrolling layers — one
            muted gray (full visible), one dark (visible only via a center-
            band mask). As an item passes through the middle of the
            container, it appears dark; everywhere else it stays muted gray.
            This is the Davis trick without JS. */}
        <div
          className="relative h-[440px] md:h-[480px] overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}
        >
          {/* Base layer: muted gray, always visible */}
          <div className="absolute inset-x-0 top-0 will-change-transform animate-[verticalTicker_28s_linear_infinite] text-zinc-400">
            {repeated.map((label, i) => (
              <div
                key={`base-${i}`}
                className="text-3xl md:text-[34px] leading-[1.5] py-1.5 tracking-tight"
              >
                {label}
              </div>
            ))}
          </div>
          {/* Highlight wrapper: STATIC overlay matching the container's
              size. Its mask cuts a dark center band. The inner div scrolls
              with the same animation as the base layer; whatever passes
              through the band appears dark, everything else is invisible
              here (and shows the gray base underneath). */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, transparent 44%, black 48%, black 52%, transparent 56%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, transparent 44%, black 48%, black 52%, transparent 56%, transparent 100%)",
            }}
          >
            <div className="absolute inset-x-0 top-0 will-change-transform animate-[verticalTicker_28s_linear_infinite] text-zinc-900">
              {repeated.map((label, i) => (
                <div
                  key={`hl-${i}`}
                  className="text-3xl md:text-[34px] leading-[1.5] py-1.5 tracking-tight"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Davis-style section eyebrow: small trait accent + uppercase mono label.
// The trait extends on viewport entry — calm, deliberate.
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: DAVIS_EASE }}
      viewport={{ once: true, margin: "-80px" }}
      className="flex items-center gap-3 mb-6"
    >
      <motion.span
        initial={{ width: 0 }}
        whileInView={{ width: 24 }}
        transition={{ duration: 1.1, delay: 0.1, ease: DAVIS_EASE }}
        viewport={{ once: true, margin: "-80px" }}
        className="block h-px bg-zinc-400"
      />
      <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
        {children}
      </span>
    </motion.div>
  );
}

// Connector status pill — live = breathing dot + brand tint, otherwise muted.
function ConnectorPill({ label, live = false }: { label: string; live?: boolean }) {
  return (
    <span
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] ${
        live
          ? "border-emerald-300/70 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-transparent text-zinc-400"
      }`}
    >
      <span className="relative flex size-1.5">
        {live && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-[pulseDot_2.4s_cubic-bezier(0.44,0,0.56,1)_infinite]" />
        )}
        <span
          className={`relative inline-flex size-1.5 rounded-full ${
            live ? "bg-emerald-500" : "bg-zinc-300"
          }`}
        />
      </span>
      <span>{label}</span>
    </span>
  );
}

// Davis signature ticker: dark bar with horizontally-scrolling announcement
// on the left and a sticky "Read more →" CTA pinned to the right. The whole
// bar is a clickable link. Mask gradients soften both edges of the scroller
// so it dissolves into the chrome on either side.
function TopTicker() {
  const message =
    "Slackmap is open-source — extract your company's brain, ship skills any AI agent can run";
  const href = "https://github.com/Jean-EmmanuelP/slackmap";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-zinc-900 text-zinc-200 text-[13px] relative"
    >
      <div className="flex items-center">
        {/* Scrolling marquee — fills the left/center, masked on both edges */}
        <div
          className="relative flex-1 overflow-hidden py-3"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 80%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 80%, transparent 100%)",
          }}
        >
          <div className="flex whitespace-nowrap will-change-transform animate-[ticker_42s_linear_infinite]">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className="px-10 tracking-[0.01em] text-zinc-300/85"
              >
                {message}
              </span>
            ))}
          </div>
        </div>

        {/* Sticky "Read more →" CTA — pinned right, doesn't scroll. */}
        <div className="shrink-0 flex items-center gap-2 pr-6 pl-4 py-3 text-zinc-300 group-hover:text-white transition-colors duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] relative">
          <span className="hidden sm:inline text-[12px] uppercase tracking-[0.18em] font-[var(--font-mono)]">
            Read more
          </span>
          <span className="relative inline-block w-[14px] h-[14px] overflow-hidden">
            <svg
              viewBox="0 0 14 14"
              className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] group-hover:translate-x-[18px] group-hover:-translate-y-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="11" x2="11" y2="3" />
              <polyline points="5 3 11 3 11 9" />
            </svg>
            <svg
              viewBox="0 0 14 14"
              className="absolute inset-0 -translate-x-[18px] translate-y-[18px] transition-transform duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] group-hover:translate-x-0 group-hover:translate-y-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="11" x2="11" y2="3" />
              <polyline points="5 3 11 3 11 9" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

// CTA button with an arrow that slides on hover (Davis-modern micro-interaction).
function CTAButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-zinc-900 text-white font-medium text-base transition-all duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] hover:bg-zinc-800 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)]"
    >
      <span>{children}</span>
      <span className="relative inline-block w-4 h-4 overflow-hidden">
        <svg
          viewBox="0 0 16 16"
          className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] group-hover:translate-x-[18px] group-hover:-translate-y-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="13" x2="13" y2="3" />
          <polyline points="6 3 13 3 13 10" />
        </svg>
        <svg
          viewBox="0 0 16 16"
          className="absolute inset-0 -translate-x-[18px] translate-y-[18px] transition-transform duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] group-hover:translate-x-0 group-hover:translate-y-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="13" x2="13" y2="3" />
          <polyline points="6 3 13 3 13 10" />
        </svg>
      </span>
    </Link>
  );
}

// Davis-exact nav: logo on the LEFT, pill links in the CENTER, contrast
// CTA pill on the RIGHT. Progressive blur backdrop (multi-layer masked
// stack) fades the chrome into the page below it — no hard border.
function Nav() {
  return (
    <nav className="sticky top-0 z-50 px-6 py-3.5">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_30%,transparent_70%)] backdrop-blur-[1px]" />
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_0%,black_30%,black_60%,transparent_100%)] backdrop-blur-[3px]" />
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_30%,black_70%,black_100%)] backdrop-blur-[8px]" />
        <div className="absolute inset-0 bg-[var(--paper)]/55" />
      </div>

      <div className="mx-auto flex max-w-[1400px] items-center gap-6">
        {/* Logo lockup — left (Davis pattern: mark + wordmark) */}
        <a
          href="/"
          aria-label="Slackmap"
          className="shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.44,0,0.56,1)] hover:scale-[1.03]"
        >
          <LogoLockup size={28} className="text-zinc-900" />
        </a>

        {/* Pill links — Davis pattern: 5 inactive pills + 1 contrast CTA.
            Matches Davis density (Vision/Mission/Services/How it works/
            Technology/Careers + Book a demo) adapted to slackmap sections. */}
        <div className="hidden lg:flex flex-1 items-center justify-end gap-1.5">
          <NavPill href="#problem">Problem</NavPill>
          <NavPill href="#solutions">Solutions</NavPill>
          <NavPill href="#use-cases">Use cases</NavPill>
          <NavPill href="#open-source">Open source</NavPill>
          <NavPill
            href="https://github.com/Jean-EmmanuelP/slackmap"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </NavPill>
        </div>
        <div className="lg:hidden flex-1" />

        {/* Active/contrast CTA pill — right (Davis "Book a demo" equivalent) */}
        <Link
          href="/login"
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-zinc-900 text-[var(--paper)] px-5 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] hover:bg-zinc-800 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]"
        >
          Get started
        </Link>
      </div>
    </nav>
  );
}

// Davis-style pill link: soft dark-tinted background on a light surface
// (the inverse of their rgba(255,255,255,0.2) over dark imagery). Hover
// deepens the tint instead of underlining — calmer, more cohesive.
function NavPill({
  href,
  children,
  target,
  rel,
}: {
  href: string;
  children: ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className="rounded-full bg-zinc-900/[0.04] hover:bg-zinc-900/[0.09] px-4 py-1.5 text-sm text-zinc-700 hover:text-zinc-900 transition-all duration-300 ease-[cubic-bezier(0.44,0,0.56,1)]"
    >
      {children}
    </a>
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
    <div className="h-full flex flex-col bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] border border-zinc-200 overflow-hidden">
      <div className="shrink-0 px-4 py-2.5 border-b border-zinc-100 flex items-center gap-1.5 bg-zinc-50/50">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        <span className="ml-3 text-xs text-zinc-400 font-mono">slackmap.io</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
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
