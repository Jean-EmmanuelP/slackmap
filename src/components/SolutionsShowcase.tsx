"use client";

import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { useRef, type ReactNode } from "react";

type Solution = {
  number: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  card: ReactNode;
};

// 4 solutions revealed sequentially as the user scrolls. Left side (number,
// eyebrow, title, description) is sticky — it cross-fades between solutions.
// Right side: cards rise up from below to take their spot, like a dealt deck.
export function SolutionsShowcase({ solutions }: { solutions: Solution[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section
      id="solutions"
      ref={ref}
      className="relative"
      style={{ height: `${solutions.length * 140}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-8 grid md:grid-cols-2 gap-16 items-center">
          {/* Left: sticky text panel — cross-fades between solutions */}
          <div className="relative h-[440px]">
            {solutions.map((s, i) => (
              <SolutionText
                key={i}
                index={i}
                total={solutions.length}
                progress={scrollYProgress}
                solution={s}
              />
            ))}
          </div>

          {/* Right: card deck — each card rises to fully replace the previous */}
          <div className="relative h-[480px] flex items-center justify-center">
            {solutions.map((s, i) => (
              <SolutionCard
                key={i}
                index={i}
                total={solutions.length}
                progress={scrollYProgress}
              >
                {s.card}
              </SolutionCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SolutionText({
  index,
  total,
  progress,
  solution,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  solution: Solution;
}) {
  // Each text panel is fully visible during its 1/total slice of scroll, with
  // a brief crossfade at the boundaries.
  const segment = 1 / total;
  const start = index * segment;
  const end = start + segment;
  const fadeIn = segment * 0.15;
  const fadeOut = segment * 0.85;

  const opacity = useTransform(
    progress,
    [start, start + fadeIn, start + fadeOut, end],
    [0, 1, 1, index === total - 1 ? 1 : 0],
  );
  const y = useTransform(
    progress,
    [start, start + fadeIn, start + fadeOut, end],
    [40, 0, 0, index === total - 1 ? 0 : -40],
  );

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col justify-center"
    >
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-[var(--font-serif)] text-5xl text-[var(--brand)] italic">
          {solution.number}
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {solution.eyebrow}
        </span>
      </div>
      <h2 className="font-[var(--font-serif)] text-4xl md:text-5xl leading-[1.05] tracking-tight">
        {solution.title}
      </h2>
      <p className="mt-6 text-zinc-600 text-base max-w-md leading-relaxed">
        {solution.description}
      </p>
    </motion.div>
  );
}

function SolutionCard({
  index,
  total,
  progress,
  children,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const segment = 1 / total;
  const start = index * segment;
  const end = start + segment;

  // Card 0 is visible from t=0. Each subsequent card rises up from y=120%,
  // arriving at y=0 at the start of its segment.
  const enterEnd = start + segment * 0.4;
  const exitStart = start + segment * 0.85;

  const yEnter = index === 0 ? 0 : 120;
  const opacityStart = index === 0 ? 1 : 0;

  // After its segment ends, a card moves fully off-screen (-120%) and goes
  // opacity 0 so it doesn't bleed through behind the next card.
  const y = useTransform(
    progress,
    [Math.max(0, start - segment * 0.3), enterEnd, exitStart, end],
    [yEnter, 0, 0, index === total - 1 ? 0 : -120],
  );
  const opacity = useTransform(
    progress,
    [Math.max(0, start - segment * 0.3), enterEnd, exitStart, end],
    [opacityStart, 1, 1, index === total - 1 ? 1 : 0],
  );
  const scale = useTransform(
    progress,
    [Math.max(0, start - segment * 0.3), enterEnd, exitStart, end],
    [0.92, 1, 1, 1],
  );

  return (
    <motion.div
      style={{
        y: useTransform(y, (v) => `${v}%`),
        opacity,
        scale,
        zIndex: index,
      }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="w-full">{children}</div>
    </motion.div>
  );
}
