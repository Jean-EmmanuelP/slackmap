"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

type Solution = {
  number: string;
  eyebrow: string;
  icon: ReactNode;
  title: ReactNode;
  description: string;
  card: ReactNode;
};

const DAVIS_EASE = [0.44, 0, 0.56, 1] as const;

// Davis "Mission" pattern (paired rows): each solution is a self-contained
// row with text on the left and its OWN card on the right, side by side.
// Pairs are stacked vertically and separated by thin dividers. Each pair
// rises into view (fade + y:28→0) once when entering viewport, then stays.
// Everything scrolls naturally — no sticky, no scroll-driven mapping.
export function SolutionsShowcase({ solutions }: { solutions: Solution[] }) {
  return (
    <section
      id="solutions"
      className="relative bg-[var(--paper)] py-24 md:py-32"
    >
      <div className="max-w-6xl mx-auto px-8">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-14 md:mb-20">
          <span className="block h-px w-6 bg-zinc-400" />
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
            Solutions
          </span>
        </div>

        <div className="flex flex-col">
          {solutions.map((s, i) => (
            <SolutionRowPair key={i} solution={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionRowPair({ solution }: { solution: Solution }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: DAVIS_EASE }}
      className="border-t border-zinc-300/70 py-12 md:py-16 first:border-t-0 first:pt-0 last:border-b last:pb-0"
    >
      <div className="grid md:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
        {/* Left: icon + eyebrow + title + description.
            No "01/02/03" number — the icon (logo) carries the visual weight. */}
        <div className="flex items-start gap-5 md:gap-6">
          <div className="shrink-0 size-11 rounded-full border border-zinc-400 flex items-center justify-center text-zinc-700">
            {solution.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <span className="block h-px w-6 bg-zinc-400" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
                {solution.eyebrow}
              </span>
            </div>
            <h3 className="font-[var(--font-serif)] text-2xl md:text-[28px] leading-[1.2] tracking-tight text-zinc-900">
              {solution.title}
            </h3>
            <p className="mt-3 text-sm md:text-base text-zinc-600 leading-relaxed max-w-md">
              {solution.description}
            </p>
          </div>
        </div>

        {/* Right: this row's own preview card. Square corners. Fixed height
            so all four pairs visually align across the page. */}
        <div className="hidden md:block">
          <div className="relative w-full max-w-md mx-auto h-[420px] overflow-hidden">
            {solution.card}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
