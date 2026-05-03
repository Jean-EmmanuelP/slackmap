// Section header for each internal page (Atlas / People / Glossary / Skills).
// Serif title + sans-serif subtitle — establishes the "value add" immediately
// instead of dropping the user into a raw table.

export function PageHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: { value: number | string; label: string };
}) {
  return (
    <header className="px-8 pt-10 pb-6 border-b border-zinc-200 bg-[var(--paper)]">
      <div className="max-w-6xl mx-auto flex items-end justify-between gap-6">
        <div>
          <h1 className="font-[var(--font-serif)] text-3xl md:text-4xl tracking-tight text-zinc-900 leading-[1.05]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">{subtitle}</p>
        </div>
        {count && (
          <div className="text-right shrink-0">
            <div className="font-[var(--font-serif)] text-3xl tracking-tight text-zinc-900 tabular-nums">
              {count.value}
            </div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mt-0.5">
              {count.label}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
