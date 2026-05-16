"use client";

// AuditPanel — the Runbook OS audit experience. One input, one button,
// the agent does the rest. After the analysis runs, the page renders the
// ranked endpoint recommendations with copy-paste code samples.

import { useState } from "react";

type AuditReport = {
  tickets_analyzed_count: number;
  coverage_current_pct: number;
  coverage_target_pct: number;
  executive_summary: string;
  detected_stack: string;
  proposed_endpoints: Array<{
    name: string;
    method: string;
    url_template: string;
    description: string;
    why: string;
    auth_hint: string;
    estimated_ticket_coverage: number;
    estimated_ticket_coverage_pct: number;
    code_sample: string;
  }>;
  already_covered: string[];
  unresolvable_gaps: string[];
  next_step: string;
};

type EndpointRow = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url_template: string;
  status: "proposed" | "implemented" | "active" | "deprecated";
  estimated_ticket_coverage: number;
  estimated_ticket_coverage_pct: number;
  live_base_url?: string | null;
};

export function AuditPanel({
  workspaceId,
  lang,
  lastReport,
  lastAuditAt,
  endpoints,
}: {
  workspaceId: string;
  lang: string;
  lastReport: unknown;
  lastAuditAt: string | null;
  endpoints: unknown[];
}) {
  const initialReport = (lastReport as AuditReport | null) ?? null;
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [detectedKind, setDetectedKind] = useState<string | null>(null);

  const fr = lang === "fr";
  const existingEndpoints = endpoints as EndpointRow[];

  async function runAudit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `${res.status}`);
      setReport(body.report as AuditReport);
      setDetectedKind(body.detected?.kind ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      <header className="mb-8 max-w-3xl">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
          Runbook Audit
        </div>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-zinc-900">
          {fr ? "Quels endpoints construire pour automatiser ton support" : "Which endpoints to build to automate your support"}
        </h1>
        <p className="mt-3 text-base text-zinc-600 leading-relaxed">
          {fr
            ? "Colle une URL d'API, une connection DB ou un admin web. L'agent croise avec tes 90 derniers jours de tickets Freshdesk et te dit exactement les 5-10 endpoints que ton équipe dev doit exposer pour automatiser 50-80% de la queue. Avec le code."
            : "Paste an API URL, a database connection string, or an admin web URL. The agent cross-references with your last 90 days of Freshdesk tickets and tells you exactly which 5-10 endpoints your dev team must expose to automate 50-80% of your queue. With code samples."}
        </p>
      </header>

      {/* Input form — one field, one button */}
      <section className="border-2 border-zinc-900 bg-white/40 p-6 max-w-3xl mb-8">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            {fr ? "Source de données" : "Data source"}
          </span>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder={
              fr
                ? "https://api.bestrong-app.com   eyJhbGciOi...  (URL puis token sur la même ligne ou en dessous)"
                : "https://api.bestrong-app.com   eyJhbGciOi...  (URL then token, same line or below)"
            }
            className="mt-2 w-full px-3 py-2 border border-zinc-300 bg-white text-sm font-[var(--font-mono)] focus:outline-none focus:border-zinc-900 disabled:opacity-60 resize-none"
          />
          <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)]">
            {fr
              ? "Accepté : URL d'API + bearer token · postgres://user:pass@host/db · https://admin.tonsite.com + cookie de session"
              : "Accepts: API URL + bearer · postgres://user:pass@host/db · https://admin.yoursite.com + session cookie"}
          </p>
        </label>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={runAudit}
            disabled={busy || raw.trim().length < 8}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-4 py-2 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy
              ? fr
                ? "Audit en cours… (~30-60s)"
                : "Running audit… (~30-60s)"
              : fr
                ? "Lancer l'audit"
                : "Run audit"}
          </button>
          {detectedKind && !busy && (
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
              {fr ? "Détecté : " : "Detected: "}
              <span className="text-emerald-700">{detectedKind}</span>
            </span>
          )}
          {error && (
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-red-700">
              {error}
            </span>
          )}
        </div>
        {busy && (
          <div className="mt-4 text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)] space-y-1">
            <div>· {fr ? "Détection du type de source" : "Detecting source type"}</div>
            <div>· {fr ? "Probe des endpoints communs" : "Probing common paths"}</div>
            <div>· {fr ? "Croisement avec tickets Freshdesk + skills" : "Cross-referencing Freshdesk tickets + skills"}</div>
            <div>· {fr ? "Génération du report" : "Generating ranked report"}</div>
          </div>
        )}
      </section>

      {/* Existing endpoint registry with status transitions — the loop
       * that ties the audit page to actual product use. proposed →
       * implemented (dev built it) → active (live URL set, agent can
       * call it) → deprecated (removed). */}
      {existingEndpoints.length > 0 && (
        <section className="mb-8">
          <div className="max-w-3xl mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)]">
              {fr ? "Registry des endpoints" : "Endpoint registry"} · {existingEndpoints.length}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {fr
                ? "Chaque endpoint progresse : proposé → implémenté (build) → actif (l'agent l'appelle). Coche au fur et à mesure que ton équipe dev les livre."
                : "Each endpoint moves: proposed → implemented (build done) → active (agent can call it). Mark as your dev team ships."}
            </p>
          </div>
          <div className="border border-zinc-200 bg-white/40 divide-y divide-zinc-100">
            {existingEndpoints.map((e) => (
              <EndpointRegistryRow
                key={e.id}
                endpoint={e}
                workspaceId={workspaceId}
                fr={fr}
              />
            ))}
          </div>
        </section>
      )}

      {/* Report */}
      {report && (
        <ReportView
          report={report}
          lang={lang}
          lastAuditAt={lastAuditAt}
        />
      )}
    </div>
  );
}

function EndpointRegistryRow({
  endpoint,
  workspaceId,
  fr,
}: {
  endpoint: EndpointRow;
  workspaceId: string;
  fr: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateUrl, setActivateUrl] = useState("");
  const [activateToken, setActivateToken] = useState("");

  async function transition(
    target: "proposed" | "implemented" | "active" | "deprecated",
    extra?: { live_base_url?: string; auth_token?: string },
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/${workspaceId}/endpoints/${endpoint.id}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target, ...extra }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  function startActivate() {
    setActivating(true);
    // Pre-fill base URL guess: strip /api/* path from url_template
    const match = endpoint.url_template.match(/^https?:\/\/[^/]+/);
    setActivateUrl(match ? match[0] : "https://");
  }

  function confirmActivate() {
    if (!activateUrl || !activateUrl.startsWith("http")) {
      setError("base URL required (https://...)");
      return;
    }
    void transition("active", {
      live_base_url: activateUrl,
      auth_token: activateToken || undefined,
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border ${
                endpoint.method === "GET"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                  : endpoint.method === "POST"
                    ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                    : endpoint.method === "DELETE"
                      ? "border-red-400 bg-red-50 text-red-800"
                      : "border-amber-400 bg-amber-50 text-amber-800"
              }`}
            >
              {endpoint.method}
            </span>
            <span className="text-sm font-[var(--font-mono)] text-zinc-900 truncate">
              {endpoint.url_template}
            </span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {endpoint.name} · {endpoint.estimated_ticket_coverage_pct}% coverage ·{" "}
            {endpoint.estimated_ticket_coverage} tix
            {endpoint.live_base_url && (
              <>
                {" "}
                ·{" "}
                <span className="text-emerald-700">
                  live at {endpoint.live_base_url}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={endpoint.status} />
        </div>
      </div>

      {/* Transition controls */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {endpoint.status === "proposed" && (
          <button
            type="button"
            onClick={() => transition("implemented")}
            disabled={busy}
            className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1 border border-indigo-700 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {fr ? "Marquer implémenté" : "Mark implemented"}
          </button>
        )}
        {endpoint.status === "implemented" && !activating && (
          <button
            type="button"
            onClick={startActivate}
            disabled={busy}
            className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1 border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {fr ? "Activer →" : "Activate →"}
          </button>
        )}
        {(endpoint.status === "active" || endpoint.status === "implemented") && (
          <button
            type="button"
            onClick={() => transition("deprecated")}
            disabled={busy}
            className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1 border border-zinc-300 text-zinc-500 hover:text-red-700"
          >
            {fr ? "Déprécier" : "Deprecate"}
          </button>
        )}
        {endpoint.status === "deprecated" && (
          <button
            type="button"
            onClick={() => transition("proposed")}
            disabled={busy}
            className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2.5 py-1 border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          >
            {fr ? "Restaurer" : "Restore"}
          </button>
        )}
        {error && (
          <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-red-700">
            {error}
          </span>
        )}
      </div>

      {/* Activation inputs */}
      {activating && (
        <div className="mt-3 p-3 border border-emerald-200 bg-emerald-50/30 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-emerald-700">
            {fr
              ? "Activer · l'agent appellera cet endpoint dans ses action plans"
              : "Activate · the agent will call this endpoint in its action plans"}
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
              {fr ? "URL de base (https://...)" : "Base URL (https://...)"}
            </span>
            <input
              type="text"
              value={activateUrl}
              onChange={(e) => setActivateUrl(e.target.value)}
              placeholder="https://api.bestrong-app.com"
              className="mt-1 w-full px-2 py-1 border border-zinc-300 bg-white text-xs font-[var(--font-mono)] focus:outline-none focus:border-zinc-900"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
              {fr ? "Bearer token (optionnel)" : "Bearer token (optional)"}
            </span>
            <input
              type="password"
              value={activateToken}
              onChange={(e) => setActivateToken(e.target.value)}
              placeholder="sk_..."
              className="mt-1 w-full px-2 py-1 border border-zinc-300 bg-white text-xs font-[var(--font-mono)] focus:outline-none focus:border-zinc-900"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmActivate}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? (fr ? "Activation…" : "Activating…") : fr ? "Confirmer activation" : "Confirm activate"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActivating(false);
                setError(null);
              }}
              className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 text-zinc-500 hover:text-zinc-900"
            >
              {fr ? "Annuler" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EndpointRow["status"] }) {
  const styles = {
    proposed: "border-zinc-300 text-zinc-600",
    implemented: "border-indigo-400 bg-indigo-50 text-indigo-800",
    active: "border-emerald-500 bg-emerald-50 text-emerald-800",
    deprecated: "border-zinc-300 text-zinc-400",
  }[status];
  return (
    <span
      className={`text-[9px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border ${styles}`}
    >
      {status}
    </span>
  );
}

function ReportView({
  report,
  lang,
  lastAuditAt,
}: {
  report: AuditReport;
  lang: string;
  lastAuditAt: string | null;
}) {
  const fr = lang === "fr";
  const upliftPct = Math.round(report.coverage_target_pct - report.coverage_current_pct);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Executive summary */}
      <section className="border-2 border-emerald-400 bg-white/60 p-6">
        <div className="text-[10px] uppercase tracking-[0.22em] font-[var(--font-mono)] text-emerald-700">
          {fr ? "Résumé exécutif" : "Executive summary"}
        </div>
        <p className="mt-2 text-lg text-zinc-900 leading-relaxed">{report.executive_summary}</p>

        <div className="mt-5 pt-5 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat
            label={fr ? "Tickets analysés" : "Tickets analyzed"}
            value={report.tickets_analyzed_count.toString()}
          />
          <Stat
            label={fr ? "Couverture actuelle" : "Current coverage"}
            value={`${report.coverage_current_pct}%`}
          />
          <Stat
            label={fr ? "Couverture cible" : "Target coverage"}
            value={`${report.coverage_target_pct}%`}
            accent
          />
          <Stat
            label={fr ? "Gain potentiel" : "Uplift"}
            value={`+${upliftPct}pts`}
            accent
          />
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          {fr ? "Stack détecté" : "Detected stack"} ·{" "}
          <span className="font-[var(--font-mono)]">{report.detected_stack}</span>
        </p>
      </section>

      {/* Ranked endpoints */}
      <section>
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-[var(--font-mono)] mb-3">
          {fr ? "Endpoints à construire" : "Endpoints to build"} · {report.proposed_endpoints.length}
        </h2>
        <div className="space-y-4">
          {report.proposed_endpoints.map((e, i) => (
            <EndpointCard key={i} rank={i + 1} endpoint={e} fr={fr} />
          ))}
        </div>
      </section>

      {/* Already covered + gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.already_covered.length > 0 && (
          <section className="border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] font-[var(--font-mono)] text-emerald-700 mb-2">
              ✓ {fr ? "Déjà couvert" : "Already covered"}
            </div>
            <ul className="space-y-1 text-sm text-zinc-700">
              {report.already_covered.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </section>
        )}
        {report.unresolvable_gaps.length > 0 && (
          <section className="border border-amber-200 bg-amber-50/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] font-[var(--font-mono)] text-amber-700 mb-2">
              ⚠ {fr ? "Gaps non-automatisables ici" : "Gaps not solvable here"}
            </div>
            <ul className="space-y-1 text-sm text-zinc-700">
              {report.unresolvable_gaps.map((g, i) => (
                <li key={i}>· {g}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Next step */}
      <section className="border-l-4 border-zinc-900 bg-zinc-50/50 px-5 py-4">
        <div className="text-[10px] uppercase tracking-[0.22em] font-[var(--font-mono)] text-zinc-500 mb-1">
          {fr ? "Prochaine étape" : "Next step"}
        </div>
        <p className="text-sm text-zinc-900">{report.next_step}</p>
      </section>

      {lastAuditAt && (
        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-[var(--font-mono)]">
          {fr ? "Dernier audit" : "Last audit"} ·{" "}
          {new Date(lastAuditAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
        </p>
      )}
    </div>
  );
}

function EndpointCard({
  rank,
  endpoint,
  fr,
}: {
  rank: number;
  endpoint: AuditReport["proposed_endpoints"][number];
  fr: boolean;
}) {
  const methodColor =
    endpoint.method === "GET"
      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
      : endpoint.method === "POST"
        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
        : endpoint.method === "DELETE"
          ? "border-red-400 bg-red-50 text-red-800"
          : "border-amber-400 bg-amber-50 text-amber-800";

  return (
    <article className="border border-zinc-300 bg-white/50 p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs uppercase tracking-wider font-[var(--font-mono)] text-zinc-400 tabular-nums">
            #{rank}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider font-[var(--font-mono)] px-1.5 py-0.5 border ${methodColor}`}
          >
            {endpoint.method}
          </span>
          <span className="text-sm font-[var(--font-mono)] text-zinc-900 truncate">
            {endpoint.url_template}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500">
            {fr ? "Couverture" : "Coverage"}
          </div>
          <div className="text-lg font-medium text-emerald-700 tabular-nums">
            {endpoint.estimated_ticket_coverage_pct}%
          </div>
          <div className="text-[10px] text-zinc-500 font-[var(--font-mono)]">
            {endpoint.estimated_ticket_coverage} tix
          </div>
        </div>
      </div>

      <p className="text-sm text-zinc-700 mb-2">{endpoint.description}</p>

      <div className="border-l-2 border-zinc-300 pl-3 py-1 mb-3">
        <div className="text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-500 mb-0.5">
          {fr ? "Pourquoi" : "Why"}
        </div>
        <p className="text-sm text-zinc-800 leading-relaxed">{endpoint.why}</p>
      </div>

      {endpoint.auth_hint && (
        <p className="text-xs text-zinc-500 mb-3">
          <span className="font-[var(--font-mono)] uppercase tracking-wider">Auth ·</span>{" "}
          {endpoint.auth_hint}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-[10px] uppercase tracking-wider font-[var(--font-mono)] text-zinc-600 hover:text-zinc-900">
          {fr ? "Voir le code à pondre" : "Show code sample"}
        </summary>
        <pre className="mt-2 p-3 bg-zinc-900 text-zinc-100 text-[11px] font-[var(--font-mono)] overflow-x-auto whitespace-pre">
          {endpoint.code_sample}
        </pre>
      </details>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)]">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-medium tabular-nums ${
          accent ? "text-emerald-700" : "text-zinc-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
