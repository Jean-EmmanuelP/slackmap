"use client";

import { useState } from "react";
import { t } from "@/lib/i18n-ui";

export type CompanyContext = {
  name: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  audience: "b2b" | "b2c" | "both" | null;
  tools: string[] | null;
  scope: "worldwide" | "national" | null;
  country: string | null;
  resolvedAt: string | null;
};

export function CompanyContextCard({
  workspaceId,
  context,
  lang,
}: {
  workspaceId: string;
  context: CompanyContext;
  lang?: string;
}) {
  const [resetting, setResetting] = useState(false);

  async function rerun() {
    if (!confirm(t("company.confirmRerun", lang))) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/linkup/finish`, { method: "DELETE" });
      if (res.ok) window.location.reload();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="col-span-12 border border-zinc-200 p-6 bg-zinc-50/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
            {t("company.contextLabel", lang)}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl font-medium text-zinc-900 truncate">{context.name ?? "—"}</h2>
            {context.website && (
              <a
                href={context.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
              >
                {context.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>
          {context.description && (
            <p className="mt-2 text-sm text-zinc-700 leading-relaxed max-w-3xl">{context.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {context.scope === "worldwide" && <Pill label={t("company.operatesIn", lang)}>{t("company.scope.worldwide", lang)}</Pill>}
            {context.scope === "national" && context.country && (
              <Pill label={t("company.operatesIn", lang)}>{t("company.scope.country", lang, { country: context.country })}</Pill>
            )}
            {context.industry && <Pill label={t("company.industry", lang)}>{context.industry}</Pill>}
            {context.audience && <Pill label={t("company.audience", lang)}>{context.audience.toUpperCase()}</Pill>}
            {context.tools && context.tools.length > 0 && (
              <Pill label={t("company.tools", lang)}>{context.tools.slice(0, 6).join(" · ")}{context.tools.length > 6 ? ` +${context.tools.length - 6}` : ""}</Pill>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={rerun}
          disabled={resetting}
          className="shrink-0 text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 hover:border-zinc-900 disabled:opacity-50"
        >
          {resetting ? "…" : t("company.rerunWizard", lang)}
        </button>
      </div>
    </section>
  );
}

function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-200 bg-[var(--paper)] text-xs">
      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
        {label}
      </span>
      <span className="text-zinc-900">{children}</span>
    </span>
  );
}
