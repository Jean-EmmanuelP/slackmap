// Definitions for the 4-step company-resolution wizard. Each step has:
//   - id        — stable key used in URLs and persisted in company_context
//   - title     — UI heading shown to the user
//   - hint      — short explanation under the heading
//   - query()   — Linkup query string built from current workspace state
//   - schema()  — JSON schema for the structured output
//   - persist() — maps the user-confirmed value into workspace column updates
//
// All steps run via linkupStructured (depth=deep, includeSources=true).

export type WizardWorkspaceState = {
  slack_team_name: string | null;
  slack_team_domain: string | null;
  company_name: string | null;
  company_website: string | null;
  company_scope: "worldwide" | "national" | null;
  company_country: string | null;
};

export type WizardStepId = 'region' | 'website' | 'description' | 'audience' | 'tools';

export type WizardQueryContext = {
  /** Regional bias appended to the query, built by regionHintFromWorkspace(). */
  regionHint?: string;
};

export type WizardStep = {
  id: WizardStepId;
  /** 'manual' steps don't call Linkup — they collect user input directly. */
  kind: 'manual' | 'linkup';
  title: string;
  hint: string;
  query?: (ws: WizardWorkspaceState, ctx?: WizardQueryContext) => string;
  schema?: Record<string, unknown>;
  persist: (confirmed: unknown, ws: WizardWorkspaceState) => Record<string, unknown>;
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'region',
    kind: 'manual',
    title: 'Where does your business operate?',
    hint: 'Knowing where you operate helps us pick the right company.',
    persist: (confirmed) => {
      const v = confirmed as { scope: 'worldwide' | 'national'; country: string | null };
      return {
        company_scope: v.scope,
        company_country: v.scope === 'national' ? v.country : null,
      };
    },
  },
  {
    id: 'website',
    kind: 'linkup',
    title: 'Is this your website?',
    hint: 'Linkup proposes 1–3 candidates from your Slack workspace name. Confirm or paste the right URL.',
    query: (ws, ctx) =>
      `Find the official website of the company "${ws.slack_team_name ?? ''}". ` +
      `Slack team domain hint: ${ws.slack_team_domain ?? ''}.slack.com. ` +
      `Return up to 3 candidates ranked by likelihood, each with the company display name, ` +
      `the homepage URL, a confidence score 0–1, and a one-sentence reasoning.` +
      (ctx?.regionHint ?? ''),
    schema: {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Official company name' },
              url: { type: 'string', description: 'Homepage URL (https://…)' },
              confidence: { type: 'number', description: '0–1 likelihood this is the right company' },
              reasoning: { type: 'string', description: 'One sentence why this candidate matches' },
            },
            required: ['name', 'url', 'confidence', 'reasoning'],
          },
        },
      },
      required: ['candidates'],
    },
    persist: (confirmed) => {
      const v = confirmed as { name: string; url: string };
      return { company_name: v.name, company_website: v.url };
    },
  },
  {
    id: 'description',
    kind: 'linkup',
    title: 'What does the company do?',
    hint: 'Linkup reads the homepage and extracts a one-liner + industry. Tweak both if needed.',
    query: (ws, ctx) =>
      `Describe what ${ws.company_name ?? ws.slack_team_name ?? ''} (${ws.company_website ?? ''}) does in one sentence. ` +
      `Identify its primary industry (e.g. "Fitness app", "Developer tools", "B2B SaaS payroll", "E-commerce fashion").` +
      (ctx?.regionHint ?? ''),
    schema: {
      type: 'object',
      properties: {
        oneLiner: { type: 'string', description: 'One-sentence description of what the company does' },
        industry: { type: 'string', description: 'Primary industry / sector, 2–5 words' },
      },
      required: ['oneLiner', 'industry'],
    },
    persist: (confirmed) => {
      const v = confirmed as { oneLiner: string; industry: string };
      return { company_description: v.oneLiner, company_industry: v.industry };
    },
  },
  {
    id: 'audience',
    kind: 'linkup',
    title: 'Who do you sell to?',
    hint: 'B2B, B2C, or both? Linkup checks the site for the dominant signal.',
    query: (ws, ctx) =>
      `Does ${ws.company_name ?? ''} (${ws.company_website ?? ''}) primarily serve B2B (businesses), B2C (consumers), or both? ` +
      `Cite a short piece of evidence from the website.` +
      (ctx?.regionHint ?? ''),
    schema: {
      type: 'object',
      properties: {
        audience: { type: 'string', enum: ['b2b', 'b2c', 'both'] },
        evidence: { type: 'string', description: 'Short quote or paraphrase from the site' },
      },
      required: ['audience', 'evidence'],
    },
    persist: (confirmed) => {
      const v = confirmed as { audience: 'b2b' | 'b2c' | 'both' };
      return { company_audience: v.audience };
    },
  },
  {
    id: 'tools',
    kind: 'manual',
    title: 'What do you build with?',
    hint: 'Add the tools, frameworks and SaaS your team actually uses. You know your stack better than the web does.',
    persist: (confirmed) => {
      const v = confirmed as { tools: string[] };
      return { company_tools: v.tools };
    },
  },
];

export function getWizardStep(id: string): WizardStep | undefined {
  return WIZARD_STEPS.find((s) => s.id === id);
}
