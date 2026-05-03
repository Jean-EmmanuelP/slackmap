// Title + subtitle row at the top of each workspace page. Square corners,
// monospaced label/count, no decorative serif — matches the Nia-style shell.

export function PageHeader({
  title,
  subtitle,
  count,
  action,
}: {
  title: string;
  subtitle: string;
  count?: { value: number | string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="px-8 py-6 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-50">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 max-w-2xl leading-relaxed">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {count && (
            <div className="text-right">
              <div className="text-2xl font-medium text-zinc-50 tabular-nums">{count.value}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mt-0.5">
                {count.label}
              </div>
            </div>
          )}
          {action}
        </div>
      </div>
    </header>
  );
}
