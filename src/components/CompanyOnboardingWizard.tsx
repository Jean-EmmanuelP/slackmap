"use client";

import { useCallback, useEffect, useState } from "react";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/linkup/wizard-steps";

type Source = { name: string; url: string; favicon?: string; content?: string };

type ProposedWebsite = { candidates: Array<{ name: string; url: string; confidence: number; reasoning: string }> };
type ProposedDescription = { oneLiner: string; industry: string };
type ProposedAudience = { audience: "b2b" | "b2c" | "both"; evidence: string };
type ProposedTools = { tools: string[] };

export type WizardInitial = {
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  companyIndustry: string | null;
  companyAudience: "b2b" | "b2c" | "both" | null;
  companyScope: "worldwide" | "national" | null;
  companyCountry: string | null;
  companyTools: string[] | null;
  companyContext: Record<string, unknown> | null;
};

type StepCache = { proposed: unknown; sources: Source[] };

function getStepCacheFromInitial(initial: WizardInitial | undefined): Map<string, StepCache> {
  const map = new Map<string, StepCache>();
  const stepsObj = (initial?.companyContext as { steps?: Record<string, unknown> } | null)?.steps;
  if (!stepsObj) return map;
  for (const [id, raw] of Object.entries(stepsObj)) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as { proposed?: unknown; confirmed?: unknown; sources?: Source[] };
    map.set(id, {
      proposed: d.proposed ?? d.confirmed ?? null,
      sources: Array.isArray(d.sources) ? d.sources : [],
    });
  }
  return map;
}

function computeInitialStepIdx(initial: WizardInitial | undefined): number {
  const cache = getStepCacheFromInitial(initial);
  for (let i = 0; i < WIZARD_STEPS.length; i++) {
    if (!cache.has(WIZARD_STEPS[i].id)) return i;
  }
  return WIZARD_STEPS.length - 1; // everything done — sit on the last step
}

export function CompanyOnboardingWizard({
  workspaceId,
  workspaceName,
  hasLinkupKey,
  hasPlatformFallback,
  initial,
}: {
  workspaceId: string;
  workspaceName: string;
  hasLinkupKey: boolean;
  hasPlatformFallback: boolean;
  initial?: WizardInitial;
}) {
  const [stepIdx, setStepIdx] = useState(() => computeInitialStepIdx(initial));
  const step = WIZARD_STEPS[stepIdx];

  const [needsKey, setNeedsKey] = useState(!hasLinkupKey && !hasPlatformFallback);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<unknown>(null);
  const [sources, setSources] = useState<Source[]>([]);

  // Cache of proposed/sources per step — survives navigation, avoids re-fetch
  // when the user goes back to a step they already validated. Initial map
  // comes from the workspace's persisted company_context (so reloads resume
  // exactly where the user left off).
  const [stepCache, setStepCache] = useState<Map<string, StepCache>>(() => getStepCacheFromInitial(initial));

  // Step-specific local input state, lazily seeded from initial workspace data
  // so a reload mid-onboarding restores everything the user already confirmed.
  const [scope, setScope] = useState<"worldwide" | "national" | null>(initial?.companyScope ?? null);
  const [country, setCountry] = useState<string>(initial?.companyCountry ?? "");
  const [detectedRegion, setDetectedRegion] = useState<{ countryCode: string | null; countryName: string | null; source: string } | null>(null);
  const [websitePick, setWebsitePick] = useState<{ name: string; url: string } | null>(
    initial?.companyName && initial?.companyWebsite
      ? { name: initial.companyName, url: initial.companyWebsite }
      : null,
  );
  const [websiteCustom, setWebsiteCustom] = useState({ name: "", url: "" });
  const [oneLiner, setOneLiner] = useState(initial?.companyDescription ?? "");
  const [industry, setIndustry] = useState(initial?.companyIndustry ?? "");
  const [audience, setAudience] = useState<"b2b" | "b2c" | "both">(initial?.companyAudience ?? "b2b");
  const [audienceEvidence, setAudienceEvidence] = useState<string>(() => {
    const stepsObj = (initial?.companyContext as { steps?: Record<string, { confirmed?: { evidence?: string } }> } | null)?.steps;
    return stepsObj?.audience?.confirmed?.evidence ?? "";
  });
  const [tools, setTools] = useState<string[]>(initial?.companyTools ?? []);
  const [newTool, setNewTool] = useState("");

  // Pre-fill the country picker when the wizard mounts using IP / Accept-Language
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workspace/${workspaceId}/linkup/detect-region`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setDetectedRegion(j);
        if (j.countryCode && !country) setCountry(j.countryCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId, country]);

  const runStep = useCallback(async (stepId: WizardStepId) => {
    setLoading(true);
    setError(null);
    setProposed(null);
    setSources([]);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/linkup/step/${stepId}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 412) setNeedsKey(true);
        throw new Error(body.detail ?? body.error ?? `${res.status}`);
      }
      const json = await res.json();
      setProposed(json.data);
      setSources((json.sources as Source[]) ?? []);

      // Pre-fill local state from the proposal
      if (stepId === "website") {
        const p = json.data as ProposedWebsite;
        if (p.candidates?.[0]) {
          setWebsitePick({ name: p.candidates[0].name, url: p.candidates[0].url });
        }
      } else if (stepId === "description") {
        const p = json.data as ProposedDescription;
        setOneLiner(p.oneLiner ?? "");
        setIndustry(p.industry ?? "");
      } else if (stepId === "audience") {
        const p = json.data as ProposedAudience;
        setAudience(p.audience ?? "b2b");
        setAudienceEvidence(p.evidence ?? "");
      } else if (stepId === "tools") {
        const p = json.data as ProposedTools;
        setTools(p.tools ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Linkup search failed");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (needsKey) return;
    // Manual steps (e.g. region, tools) don't call Linkup — they collect input directly.
    if (step.kind === "manual") {
      setProposed(null);
      setSources([]);
      setLoading(false);
      return;
    }
    // Already cached (from a previous session OR earlier in this one) — show
    // the previous result without burning another Linkup credit. The user can
    // hit "Re-search" to force a fresh fetch.
    const cached = stepCache.get(step.id);
    if (cached) {
      setProposed(cached.proposed);
      setSources(cached.sources);
      setLoading(false);
      return;
    }
    void runStep(step.id);
  }, [needsKey, step.id, step.kind, stepCache, runStep]);

  async function saveKey() {
    setKeySaving(true);
    setKeyError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/linkup/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `${res.status}`);
      }
      setNeedsKey(false);
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setKeySaving(false);
    }
  }

  function getConfirmedValue(): unknown | null {
    if (step.id === "region") {
      if (!scope) return null;
      if (scope === "national" && !country) return null;
      return { scope, country: scope === "national" ? country : null };
    }
    if (step.id === "website") {
      const v = websitePick ?? (websiteCustom.url ? websiteCustom : null);
      return v && v.url ? v : null;
    }
    if (step.id === "description") {
      return oneLiner && industry ? { oneLiner, industry } : null;
    }
    if (step.id === "audience") {
      return audience ? { audience, evidence: audienceEvidence } : null;
    }
    if (step.id === "tools") {
      return tools.length > 0 ? { tools } : null;
    }
    return null;
  }

  async function confirmAndNext() {
    const confirmed = getConfirmedValue();
    if (!confirmed) {
      setError("Please fill in the answer before continuing.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/linkup/step/${step.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed, proposed, sources }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }

      // Cache this step's confirmed result so back/forward nav doesn't refetch.
      setStepCache((prev) => {
        const next = new Map(prev);
        next.set(step.id, { proposed: proposed ?? confirmed, sources });
        return next;
      });

      if (stepIdx === WIZARD_STEPS.length - 1) {
        // Last step → finish, then leave the standalone /onboarding screen
        // and land on the dashboard with the freshly-resolved context.
        const finishRes = await fetch(`/api/workspace/${workspaceId}/linkup/finish`, { method: "POST" });
        if (!finishRes.ok) throw new Error("Failed to finalise");
        window.location.href = `/home?ws=${workspaceId}`;
      } else {
        setStepIdx(stepIdx + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setLoading(false);
    }
  }

  if (needsKey) {
    return (
      <div className="flex-1 px-8 py-12 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
            Onboarding · 0 of {WIZARD_STEPS.length}
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900">
            Welcome to {workspaceName}
          </h1>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            Before we build your company brain, we&apos;ll resolve a few facts about your business so the
            extraction agent stops working blind. We use{" "}
            <a
              href="https://linkup.so"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-zinc-900"
            >
              Linkup
            </a>{" "}
            (real-time, source-cited web search) — paste your API key to get started. Get one at{" "}
            <a
              href="https://app.linkup.so"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-zinc-900"
            >
              app.linkup.so
            </a>{" "}
            (free tier available).
          </p>

          <div className="mt-6 border border-zinc-200 p-5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              Linkup API key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="lk-…"
              className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm font-[var(--font-mono)] focus:outline-none focus:border-zinc-900"
            />
            {keyError && <p className="mt-2 text-xs text-red-700 font-[var(--font-mono)]">{keyError}</p>}
            <button
              onClick={saveKey}
              disabled={keySaving || !keyInput.trim()}
              className="mt-3 text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
            >
              {keySaving ? "Verifying…" : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-8 py-12 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
          Onboarding · Step {stepIdx + 1} of {WIZARD_STEPS.length}
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-zinc-900">{step.title}</h1>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{step.hint}</p>

        <div className="mt-3 flex gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 ${i <= stepIdx ? "bg-zinc-900" : "bg-zinc-200"}`}
            />
          ))}
        </div>

        <div className="mt-8 border border-zinc-200 p-6">
          {loading && step.kind === "linkup" && <LinkupThinking stepId={step.id as Exclude<WizardStepId, "region">} />}

          {step.id === "region" && (
            <RegionStep
              scope={scope}
              setScope={setScope}
              country={country}
              setCountry={setCountry}
              detectedRegion={detectedRegion}
            />
          )}

          {!loading && step.id === "website" && !!proposed && (
            <WebsiteStep
              proposed={proposed as ProposedWebsite}
              pick={websitePick}
              setPick={setWebsitePick}
              custom={websiteCustom}
              setCustom={setWebsiteCustom}
            />
          )}

          {!loading && step.id === "description" && (
            <div className="space-y-4">
              <Field label="One-line description">
                <input
                  value={oneLiner}
                  onChange={(e) => setOneLiner(e.target.value)}
                  className="w-full border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
                />
              </Field>
              <Field label="Industry">
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
                />
              </Field>
            </div>
          )}

          {!loading && step.id === "audience" && (
            <div className="space-y-4">
              <Field label="Audience">
                <div className="flex gap-2">
                  {(["b2b", "b2c", "both"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAudience(a)}
                      className={`px-4 py-2 text-xs uppercase tracking-wider font-[var(--font-mono)] border ${
                        audience === a
                          ? "bg-zinc-900 text-[var(--paper)] border-zinc-900"
                          : "border-zinc-300 text-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Evidence (optional)">
                <input
                  value={audienceEvidence}
                  onChange={(e) => setAudienceEvidence(e.target.value)}
                  placeholder="Quote from the site that supports this"
                  className="w-full border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
                />
              </Field>
            </div>
          )}

          {!loading && step.id === "tools" && (
            <div className="space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
                  Quick add
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TOOLS.map((t) => {
                    const added = tools.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => {
                          if (!added) setTools([...tools, t.name]);
                        }}
                        disabled={added}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors ${
                          added
                            ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-default"
                            : t.featured
                              ? "border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-[var(--paper)]"
                              : "border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"
                        }`}
                      >
                        {added ? (
                          <span className="text-emerald-600 text-[10px]">✓</span>
                        ) : (
                          <span className="text-zinc-400 text-[10px]">+</span>
                        )}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {tools.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
                    Your stack ({tools.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tools.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-2 py-1 border border-zinc-300 text-zinc-700 text-xs font-[var(--font-mono)]"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => setTools(tools.filter((x) => x !== t))}
                          className="text-zinc-400 hover:text-red-700"
                          aria-label={`Remove ${t}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
                  Something else?
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = newTool.trim();
                        if (v && !tools.includes(v)) setTools([...tools, v]);
                        setNewTool("");
                      }
                    }}
                    placeholder="Add a custom tool…"
                    className="flex-1 border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newTool.trim();
                      if (v && !tools.includes(v)) setTools([...tools, v]);
                      setNewTool("");
                    }}
                    className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 hover:border-zinc-900"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && step.kind === "linkup" && sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-zinc-100">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
                Sources from Linkup
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.slice(0, 6).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2 py-1 border border-zinc-200 text-zinc-600 text-xs hover:border-zinc-500 hover:text-zinc-900 max-w-xs truncate"
                    title={s.url}
                  >
                    {s.favicon && (
                      <img src={s.favicon} alt="" className="size-3" loading="lazy" />
                    )}
                    <span className="truncate">{s.name || new URL(s.url).hostname}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => stepIdx > 0 && setStepIdx(stepIdx - 1)}
            disabled={stepIdx === 0 || loading}
            className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {step.kind === "linkup" && (
              <button
                type="button"
                onClick={() => {
                  // Force a fresh fetch by busting the cached entry first.
                  setStepCache((prev) => {
                    const next = new Map(prev);
                    next.delete(step.id);
                    return next;
                  });
                  void runStep(step.id);
                }}
                disabled={loading}
                className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-300 hover:border-zinc-900 disabled:opacity-50"
              >
                {loading ? "Searching…" : "Re-search"}
              </button>
            )}
            <button
              type="button"
              onClick={confirmAndNext}
              disabled={loading || !getConfirmedValue()}
              className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
            >
              {stepIdx === WIZARD_STEPS.length - 1 ? "Finish" : "Confirm & next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick-add tool list shown at the tools step. `featured: true` highlights
// the four primary tools we already know how to mine (or plan to next),
// putting them visually first. The rest are common SaaS so the user almost
// never has to type a name.
const SUGGESTED_TOOLS: Array<{ name: string; featured?: boolean }> = [
  { name: "Slack", featured: true },
  { name: "Gmail", featured: true },
  { name: "Freshdesk", featured: true },
  { name: "Asana", featured: true },
  { name: "Notion" },
  { name: "Linear" },
  { name: "Jira" },
  { name: "GitHub" },
  { name: "GitLab" },
  { name: "Google Drive" },
  { name: "Figma" },
  { name: "Stripe" },
  { name: "HubSpot" },
  { name: "Intercom" },
  { name: "Zendesk" },
  { name: "Zoom" },
  { name: "Outlook" },
  { name: "Microsoft Teams" },
];

// Common-country shortlist + everything else generated from Intl.DisplayNames.
const COMMON_COUNTRIES = ["FR", "BE", "CH", "LU", "GB", "DE", "ES", "IT", "NL", "PT", "US", "CA"];

function buildCountryList(): Array<{ code: string; name: string }> {
  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return COMMON_COUNTRIES.map((c) => ({ code: c, name: c }));
  }
  // ISO 3166-1 alpha-2 — the small set we ship in the UI. ~250 codes total
  // would be overkill for a shortlist; users can type any code in the input.
  const allCodes = [
    "AD","AE","AF","AG","AI","AL","AM","AO","AR","AT","AU","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ",
    "BN","BO","BR","BS","BT","BW","BY","BZ","CA","CD","CF","CG","CH","CI","CL","CM","CN","CO","CR","CU","CV",
    "CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","ER","ES","ET","FI","FJ","FM","FR","GA","GB","GD",
    "GE","GH","GM","GN","GQ","GR","GT","GW","GY","HN","HR","HT","HU","ID","IE","IL","IN","IQ","IR","IS","IT",
    "JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KZ","LA","LB","LC","LI","LK","LR","LS","LT",
    "LU","LV","LY","MA","MC","MD","ME","MG","MH","MK","ML","MM","MN","MR","MT","MU","MV","MW","MX","MY","MZ",
    "NA","NE","NG","NI","NL","NO","NP","NR","NZ","OM","PA","PE","PG","PH","PK","PL","PT","PW","PY","QA","RO",
    "RS","RU","RW","SA","SB","SC","SD","SE","SG","SI","SK","SL","SM","SN","SO","SR","SS","ST","SV","SY","SZ",
    "TD","TG","TH","TJ","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VA","VC","VE",
    "VN","VU","WS","YE","ZA","ZM","ZW",
  ];
  return allCodes
    .map((code) => ({ code, name: displayNames!.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let _countryListCache: Array<{ code: string; name: string }> | null = null;
function getCountryList() {
  if (!_countryListCache) _countryListCache = buildCountryList();
  return _countryListCache;
}

function RegionStep({
  scope,
  setScope,
  country,
  setCountry,
  detectedRegion,
}: {
  scope: "worldwide" | "national" | null;
  setScope: (v: "worldwide" | "national" | null) => void;
  country: string;
  setCountry: (v: string) => void;
  detectedRegion: { countryCode: string | null; countryName: string | null; source: string } | null;
}) {
  const countries = getCountryList();
  const detectedNote =
    detectedRegion?.countryName && detectedRegion.source !== "unknown"
      ? `Detected: ${detectedRegion.countryName} (${detectedRegion.source === "vercel-ip" ? "from your IP" : "from your browser language"}). Confirm or change.`
      : "We couldn't auto-detect your country — pick from the list.";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setScope("national")}
          className={`flex flex-col items-start gap-2 p-5 border text-left ${
            scope === "national"
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <span className="text-2xl" aria-hidden>📍</span>
          <span className="text-sm font-medium text-zinc-900">National</span>
          <span className="text-xs text-zinc-500 leading-relaxed">
            One country, primarily local customers. Linkup will hard-filter to that country.
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setScope("worldwide");
            setCountry("");
          }}
          className={`flex flex-col items-start gap-2 p-5 border text-left ${
            scope === "worldwide"
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <span className="text-2xl" aria-hidden>🌍</span>
          <span className="text-sm font-medium text-zinc-900">Worldwide</span>
          <span className="text-xs text-zinc-500 leading-relaxed">
            Global / multi-country footprint. Linkup searches without regional bias.
          </span>
        </button>
      </div>

      {scope === "national" && (
        <div className="space-y-2 pt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            Country
          </div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full border border-zinc-300 px-3 py-2 text-sm bg-[var(--paper)] focus:outline-none focus:border-zinc-900"
          >
            <option value="">Select a country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 font-[var(--font-mono)]">{detectedNote}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1 font-[var(--font-mono)]">
        {label}
      </div>
      {children}
    </div>
  );
}

const THINKING_STAGES: Record<Exclude<WizardStepId, "region">, string[]> = {
  website: [
    "Reaching out to Linkup",
    "Searching the web for matching companies",
    "Filtering candidates by relevance",
    "Building source citations",
    "Almost there",
  ],
  description: [
    "Reaching out to Linkup",
    "Reading the homepage",
    "Identifying the industry",
    "Synthesising a one-liner",
    "Almost there",
  ],
  audience: [
    "Reaching out to Linkup",
    "Scanning the site for B2B / B2C signals",
    "Looking for evidence quotes",
    "Almost there",
  ],
  tools: [
    "Reaching out to Linkup",
    "Crawling job ads and GitHub",
    "Reading public tech blog posts",
    "Compiling the tool list",
    "Almost there",
  ],
};

function LinkupThinking({ stepId }: { stepId: Exclude<WizardStepId, "region"> }) {
  const stages = THINKING_STAGES[stepId];
  const [activeIdx, setActiveIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
    setElapsed(0);
    const stageMs = 3200;
    const stageTimer = setInterval(() => {
      setActiveIdx((i) => (i < stages.length - 1 ? i + 1 : i));
    }, stageMs);
    const tickTimer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(stageTimer);
      clearInterval(tickTimer);
    };
  }, [stepId, stages.length]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="relative inline-flex size-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-zinc-900 opacity-50 animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-zinc-900" />
        </span>
        <span className="text-sm text-zinc-700 font-[var(--font-mono)]">
          Linkup is thinking
          <span className="ml-1 inline-flex">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-zinc-400 font-[var(--font-mono)] tabular-nums">
          {elapsed}s
        </span>
      </div>

      <ul className="space-y-2">
        {stages.map((stage, i) => {
          const status = i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          return (
            <li
              key={stage}
              className={`flex items-center gap-3 text-xs font-[var(--font-mono)] transition-opacity duration-500 ${
                status === "pending" ? "opacity-30" : "opacity-100"
              }`}
            >
              {status === "done" && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-emerald-600"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6.5L5 9L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {status === "active" && (
                <span className="relative inline-flex size-3 items-center justify-center">
                  <span className="absolute size-3 rounded-full border border-zinc-400 animate-ping opacity-70" />
                  <span className="size-1.5 rounded-full bg-zinc-900" />
                </span>
              )}
              {status === "pending" && (
                <span className="size-3 rounded-full border border-zinc-200" />
              )}
              <span className={status === "done" ? "text-zinc-500 line-through decoration-zinc-200" : "text-zinc-800"}>
                {stage}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Skeleton for the upcoming answer */}
      <div className="pt-5 mt-2 border-t border-zinc-100 space-y-2.5">
        <div className="h-2.5 bg-zinc-100 rounded animate-pulse w-3/4" />
        <div className="h-2.5 bg-zinc-100 rounded animate-pulse w-1/2" />
        <div className="h-2.5 bg-zinc-100 rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1 rounded-full bg-zinc-700 mx-0.5 animate-bounce"
      style={{ animationDelay: delay, animationDuration: "1100ms" }}
    />
  );
}

function WebsiteStep({
  proposed,
  pick,
  setPick,
  custom,
  setCustom,
}: {
  proposed: ProposedWebsite;
  pick: { name: string; url: string } | null;
  setPick: (v: { name: string; url: string } | null) => void;
  custom: { name: string; url: string };
  setCustom: (v: { name: string; url: string }) => void;
}) {
  return (
    <div className="space-y-3">
      {(proposed.candidates ?? []).map((c, i) => {
        const selected = pick?.url === c.url;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              setPick({ name: c.name, url: c.url });
              setCustom({ name: "", url: "" });
            }}
            className={`w-full text-left border p-4 ${
              selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-zinc-900">{c.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-[var(--font-mono)] tabular-nums">
                {Math.round((c.confidence ?? 0) * 100)}%
              </span>
            </div>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block mt-1 text-xs text-zinc-600 hover:text-zinc-900 truncate"
            >
              {c.url}
            </a>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{c.reasoning}</p>
          </button>
        );
      })}

      <div className="pt-3 border-t border-zinc-100">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2 font-[var(--font-mono)]">
          None of these? Enter manually
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={custom.name}
            onChange={(e) => {
              setCustom({ ...custom, name: e.target.value });
              if (e.target.value || custom.url) setPick(null);
            }}
            placeholder="Company name"
            className="border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
          />
          <input
            value={custom.url}
            onChange={(e) => {
              setCustom({ ...custom, url: e.target.value });
              if (custom.name || e.target.value) setPick(null);
            }}
            placeholder="https://example.com"
            className="border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
          />
        </div>
      </div>
    </div>
  );
}
